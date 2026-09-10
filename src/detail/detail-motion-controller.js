/**
 * FLOWFRAME detail motion controller.
 *
 * The controller owns only motion state. It does not read or write the DOM,
 * media elements, location, history, or project data. Consumers render each
 * immutable snapshot and decide how commit/settle events affect the UI/hash.
 */

const DEFAULT_CONFIG = Object.freeze({
  // Input and speed, in work-segments per second.
  impulseGain: 0.012,
  stepVelocity: 0.92,
  directVelocity: 0.82,
  maxVelocity: 2.4,

  // Free movement and snap physics. Damping is exponential and frame-rate
  // independent. Spring integration is protected by maxDeltaSeconds.
  friction: 4.8,
  springStrength: 38,
  springDamping: 9.5,
  predictionSeconds: 0.22,
  inputIdleMs: 120,
  maxDeltaSeconds: 1 / 30,

  // Centralized switching thresholds.
  commitThreshold: 0.5,
  dominantEnterProgress: 0.55,
  dominantExitProgress: 0.45,
  settlePositionEpsilon: 0.0015,
  settleVelocityEpsilon: 0.008,

  reducedMotion: false,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const wrapIndex = (value, count) => {
  if (count <= 1) return 0;
  return ((Math.trunc(value) % count) + count) % count;
};

const asFiniteNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const asPositiveNumber = (value, fallback, minimum = Number.EPSILON) =>
  Math.max(minimum, asFiniteNumber(value, fallback));

const createConfig = (input = {}) => {
  const dominantEnterProgress = clamp(
    asFiniteNumber(input.dominantEnterProgress, DEFAULT_CONFIG.dominantEnterProgress),
    0.5,
    0.95,
  );
  const dominantExitProgress = clamp(
    asFiniteNumber(input.dominantExitProgress, DEFAULT_CONFIG.dominantExitProgress),
    0.05,
    0.5,
  );

  return Object.freeze({
    impulseGain: asPositiveNumber(input.impulseGain, DEFAULT_CONFIG.impulseGain),
    stepVelocity: asPositiveNumber(input.stepVelocity, DEFAULT_CONFIG.stepVelocity),
    directVelocity: asPositiveNumber(input.directVelocity, DEFAULT_CONFIG.directVelocity),
    maxVelocity: asPositiveNumber(input.maxVelocity, DEFAULT_CONFIG.maxVelocity),
    friction: asPositiveNumber(input.friction, DEFAULT_CONFIG.friction),
    springStrength: asPositiveNumber(input.springStrength, DEFAULT_CONFIG.springStrength),
    springDamping: asPositiveNumber(input.springDamping, DEFAULT_CONFIG.springDamping),
    predictionSeconds: Math.max(0, asFiniteNumber(input.predictionSeconds, DEFAULT_CONFIG.predictionSeconds)),
    inputIdleMs: Math.max(0, asFiniteNumber(input.inputIdleMs, DEFAULT_CONFIG.inputIdleMs)),
    maxDeltaSeconds: clamp(
      asPositiveNumber(input.maxDeltaSeconds, DEFAULT_CONFIG.maxDeltaSeconds),
      1 / 240,
      0.1,
    ),
    commitThreshold: clamp(
      asFiniteNumber(input.commitThreshold, DEFAULT_CONFIG.commitThreshold),
      0.15,
      0.85,
    ),
    dominantEnterProgress,
    dominantExitProgress: Math.min(dominantExitProgress, dominantEnterProgress),
    settlePositionEpsilon: asPositiveNumber(
      input.settlePositionEpsilon,
      DEFAULT_CONFIG.settlePositionEpsilon,
    ),
    settleVelocityEpsilon: asPositiveNumber(
      input.settleVelocityEpsilon,
      DEFAULT_CONFIG.settleVelocityEpsilon,
    ),
    reducedMotion: Boolean(input.reducedMotion),
  });
};

const defaultNow = () => globalThis.performance?.now?.() ?? Date.now();

const defaultRequestFrame = (callback) => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(() => callback(defaultNow()), 16);
};

const defaultCancelFrame = (handle) => {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle);
    return;
  }
  globalThis.clearTimeout(handle);
};

/**
 * @typedef {Object} DetailMotionSnapshot
 * @property {number} count Number of works. Always at least 1.
 * @property {number} position Signed local segment displacement in [-1, 1].
 * @property {number} velocity Signed velocity in work-segments per second.
 * @property {number} currentIndex Stable origin of the active segment.
 * @property {number} targetIndex Target of the active segment. It can be any
 *   index for a direct hash jump and is otherwise an adjacent cyclic index.
 * @property {number} progress Absolute visual progress in [0, 1].
 * @property {-1|0|1} direction Visual/navigation direction for the pair.
 * @property {number} dominantIndex Index that currently owns copy and ARIA.
 * @property {boolean} isSettled True only at a stable work boundary.
 * @property {boolean} isPaused True when at least one pause reason is active.
 * @property {string|null} pauseReason Most recently added pause reason.
 * @property {string} source Source that started or most recently changed motion.
 * @property {'idle'|'continuous'|'discrete'|'direct'|'snap'} motionKind
 */

/**
 * @typedef {Object} DetailMotionOptions
 * @property {number} count
 * @property {number} [initialIndex=0]
 * @property {Object} [config]
 * @property {(snapshot: DetailMotionSnapshot) => void} [onUpdate]
 * @property {(index: number, meta: Object) => void} [onDominantChange]
 * @property {(index: number, meta: Object) => void} [onCommit]
 * @property {(index: number, meta: Object) => void} [onSettle]
 */

/**
 * Create a single-RAF, reversible controller for FLOWFRAME work detail motion.
 *
 * Normal wheel impulses may continue during a continuous switch and can reduce
 * or reverse velocity. Discrete `step()` and `goTo()` calls are locked until
 * their pair settles. A direct `goTo()` always makes one current/target pair,
 * even when the target is not adjacent in the six-item cycle.
 *
 * Optional deterministic clock hooks can be passed inside `config` as
 * `requestFrame(callback)`, `cancelFrame(handle)`, and `now()` for tests.
 *
 * @param {DetailMotionOptions} options
 */
export function createDetailMotionController(options = {}) {
  const config = createConfig(options.config);
  const requestFrame = options.config?.requestFrame || defaultRequestFrame;
  const cancelFrame = options.config?.cancelFrame || defaultCancelFrame;
  const now = options.config?.now || defaultNow;
  const onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : () => {};
  const onDominantChange = typeof options.onDominantChange === 'function'
    ? options.onDominantChange
    : () => {};
  const onCommit = typeof options.onCommit === 'function' ? options.onCommit : () => {};
  const onSettle = typeof options.onSettle === 'function' ? options.onSettle : () => {};

  let count = Math.max(1, Math.trunc(asFiniteNumber(options.count, 1)));
  let currentIndex = wrapIndex(asFiniteNumber(options.initialIndex, 0), count);
  let targetIndex = currentIndex;
  let dominantIndex = currentIndex;
  let position = 0;
  let velocity = 0;
  let direction = 0;
  let lastDirection = 1;
  let source = 'initial';
  let motionKind = 'idle';
  let snapDestination = null;
  let targetIsDominant = false;
  let settled = true;
  let destroyed = false;
  let frameHandle = null;
  let lastFrameTime = null;
  let lastInputTime = -Infinity;
  let latestPauseReason = null;
  const pauseReasons = new Set();

  const progress = () => clamp(Math.abs(position), 0, 1);

  /** @returns {Readonly<DetailMotionSnapshot>} */
  const getSnapshot = () => Object.freeze({
    count,
    position,
    velocity,
    currentIndex,
    targetIndex,
    progress: progress(),
    direction,
    dominantIndex,
    isSettled: settled,
    isPaused: pauseReasons.size > 0,
    pauseReason: latestPauseReason,
    source,
    motionKind,
  });

  const emitUpdate = () => {
    if (!destroyed) onUpdate(getSnapshot());
  };

  const eventMeta = (reason, extra = {}) => Object.freeze({
    reason,
    source,
    direction,
    progress: progress(),
    currentIndex,
    targetIndex,
    direct: motionKind === 'direct',
    ...extra,
  });

  const stopFrame = () => {
    if (frameHandle !== null) cancelFrame(frameHandle);
    frameHandle = null;
    lastFrameTime = null;
  };

  const scheduleFrame = () => {
    if (destroyed || pauseReasons.size || settled || frameHandle !== null) return;
    frameHandle = requestFrame(runFrame);
  };

  const setDominant = (index, reason) => {
    const normalized = wrapIndex(index, count);
    if (normalized === dominantIndex) return;
    dominantIndex = normalized;
    onDominantChange(dominantIndex, eventMeta(reason));
  };

  const refreshDominant = () => {
    const value = progress();
    if (!targetIsDominant && value >= config.dominantEnterProgress) {
      targetIsDominant = true;
      setDominant(targetIndex, 'midpoint-enter');
    } else if (targetIsDominant && value <= config.dominantExitProgress) {
      targetIsDominant = false;
      setDominant(currentIndex, 'midpoint-exit');
    }
  };

  const resetStableState = (index, nextSource = source) => {
    currentIndex = wrapIndex(index, count);
    targetIndex = currentIndex;
    dominantIndex = currentIndex;
    position = 0;
    velocity = 0;
    direction = 0;
    source = nextSource;
    motionKind = 'idle';
    snapDestination = null;
    targetIsDominant = false;
    settled = true;
    stopFrame();
  };

  const settleAtOrigin = (reason) => {
    if (targetIsDominant) setDominant(currentIndex, 'midpoint-exit');
    const settledDirection = direction;
    resetStableState(currentIndex);
    const meta = eventMeta(reason, { direction: settledDirection, committed: false });
    emitUpdate();
    onSettle(currentIndex, meta);
  };

  const commitAndSettle = (reason) => {
    const fromIndex = currentIndex;
    const toIndex = targetIndex;
    const committedDirection = direction;
    if (!targetIsDominant) {
      targetIsDominant = true;
      setDominant(toIndex, 'midpoint-enter');
    }
    resetStableState(toIndex);
    const meta = eventMeta(reason, {
      direction: committedDirection,
      fromIndex,
      toIndex,
      committed: true,
    });
    onCommit(currentIndex, meta);
    emitUpdate();
    onSettle(currentIndex, meta);
  };

  const chooseAdjacentTarget = (nextDirection) => {
    direction = nextDirection < 0 ? -1 : 1;
    lastDirection = direction;
    targetIndex = wrapIndex(currentIndex + direction, count);
    targetIsDominant = false;
  };

  const commitAndContinue = (residual) => {
    const fromIndex = currentIndex;
    const toIndex = targetIndex;
    const committedDirection = direction;
    if (!targetIsDominant) {
      targetIsDominant = true;
      setDominant(toIndex, 'midpoint-enter');
    }

    currentIndex = toIndex;
    position = clamp(residual, -0.999999, 0.999999);
    chooseAdjacentTarget(committedDirection);
    settled = false;
    motionKind = 'continuous';
    snapDestination = null;

    onCommit(currentIndex, eventMeta('segment-boundary', {
      direction: committedDirection,
      fromIndex,
      toIndex,
      committed: true,
    }));
  };

  const reverseAcrossOrigin = () => {
    const reversedDirection = velocity < 0 ? -1 : 1;
    chooseAdjacentTarget(reversedDirection);
    targetIsDominant = false;
    setDominant(currentIndex, 'origin-cross');
    motionKind = 'continuous';
    snapDestination = null;
  };

  const applyBoundaries = () => {
    if (direction > 0 && position >= 1) {
      if (snapDestination === 1 || motionKind !== 'continuous') {
        commitAndSettle('target-settle');
        return true;
      }
      commitAndContinue(position - 1);
      return false;
    }

    if (direction < 0 && position <= -1) {
      if (snapDestination === -1 || motionKind !== 'continuous') {
        commitAndSettle('target-settle');
        return true;
      }
      commitAndContinue(position + 1);
      return false;
    }

    const crossedOrigin = (direction > 0 && position < 0) || (direction < 0 && position > 0);
    if (crossedOrigin) {
      if (snapDestination === 0) {
        settleAtOrigin('origin-settle');
        return true;
      }
      reverseAcrossOrigin();
    }
    return false;
  };

  const chooseSnapDestination = () => {
    if (settled || direction === 0) return 0;
    const predicted = position + velocity * config.predictionSeconds;
    const projected = predicted * direction;
    return projected >= config.commitThreshold ? direction : 0;
  };

  const beginSnap = () => {
    snapDestination = chooseSnapDestination();
    motionKind = motionKind === 'direct' || motionKind === 'discrete' ? motionKind : 'snap';
  };

  const checkSpringSettle = () => {
    if (snapDestination === null) return false;
    const distance = Math.abs(position - snapDestination);
    if (distance > config.settlePositionEpsilon || Math.abs(velocity) > config.settleVelocityEpsilon) {
      return false;
    }
    if (snapDestination === 0) settleAtOrigin('origin-settle');
    else commitAndSettle('target-settle');
    return true;
  };

  function runFrame(frameTime) {
    frameHandle = null;
    if (destroyed || pauseReasons.size || settled) return;

    const timestamp = Number.isFinite(frameTime) ? frameTime : now();
    if (lastFrameTime === null) {
      lastFrameTime = timestamp;
      emitUpdate();
      scheduleFrame();
      return;
    }

    const dt = clamp((timestamp - lastFrameTime) / 1000, 0, config.maxDeltaSeconds);
    lastFrameTime = timestamp;

    if (motionKind === 'continuous'
      && snapDestination === null
      && timestamp - lastInputTime >= config.inputIdleMs) {
      beginSnap();
    }

    if (snapDestination === null) {
      velocity *= Math.exp(-config.friction * dt);
      position += velocity * dt;
    } else {
      const displacement = snapDestination - position;
      velocity += displacement * config.springStrength * dt;
      velocity *= Math.exp(-config.springDamping * dt);
      velocity = clamp(velocity, -config.maxVelocity, config.maxVelocity);
      position += velocity * dt;
    }

    if (applyBoundaries()) return;
    refreshDominant();
    if (checkSpringSettle()) return;

    position = clamp(position, -1, 1);
    emitUpdate();
    scheduleFrame();
  }

  const shortestDirection = (index) => {
    const forward = wrapIndex(index - currentIndex, count);
    const backward = wrapIndex(currentIndex - index, count);
    if (forward === backward) return lastDirection || 1;
    return forward < backward ? 1 : -1;
  };

  const beginPair = (index, nextDirection, nextSource, kind) => {
    source = String(nextSource || kind);
    position = 0;
    velocity = 0;
    chooseAdjacentTarget(nextDirection);
    targetIndex = wrapIndex(index, count);
    motionKind = kind;
    settled = false;
    snapDestination = direction;
    lastInputTime = now();
    velocity = direction * (kind === 'direct' ? config.directVelocity : config.stepVelocity);
    lastFrameTime = null;
    emitUpdate();
    scheduleFrame();
  };

  const settleImmediately = (index, nextSource, reason, direct = false) => {
    const normalized = wrapIndex(index, count);
    const fromIndex = currentIndex;
    const changed = normalized !== currentIndex;
    source = String(nextSource || source);
    if (changed) {
      direction = shortestDirection(normalized);
      targetIndex = normalized;
      dominantIndex = normalized;
      onDominantChange(normalized, eventMeta('reduced-motion-dominant', { direct }));
    }
    resetStableState(normalized, source);
    const meta = eventMeta(reason, {
      fromIndex,
      toIndex: normalized,
      committed: changed,
      direct,
      reducedMotion: true,
    });
    if (changed) onCommit(normalized, meta);
    emitUpdate();
    onSettle(normalized, meta);
    return changed;
  };

  /**
   * Add a continuous signed impulse. Positive values move to Next and negative
   * values move to Prev. Further impulses always feed the same RAF controller,
   * including during a discrete/direct pair; they never create another pair or
   * timeline. Repeated `step()` calls remain locked until settle.
   *
   * @param {number} delta
   * @param {{source?: string, time?: number}} [meta]
   * @returns {boolean} Whether the impulse was accepted.
   */
  const impulse = (delta, { source: nextSource = 'wheel', time } = {}) => {
    if (destroyed || pauseReasons.size || count < 2) return false;
    const numericDelta = asFiniteNumber(delta, 0);
    if (numericDelta === 0) return false;

    if (config.reducedMotion) {
      return settleImmediately(
        currentIndex + (numericDelta < 0 ? -1 : 1),
        nextSource,
        'reduced-motion-impulse',
      );
    }

    const startsNewMotion = settled;
    if (startsNewMotion) {
      settled = false;
      motionKind = 'continuous';
      source = String(nextSource || 'wheel');
      chooseAdjacentTarget(numericDelta < 0 ? -1 : 1);
    } else {
      motionKind = 'continuous';
      source = String(nextSource || source);
    }

    snapDestination = null;
    lastInputTime = Number.isFinite(time) ? time : now();
    velocity = clamp(
      velocity + numericDelta * config.impulseGain,
      -config.maxVelocity,
      config.maxVelocity,
    );
    if (startsNewMotion) lastFrameTime = null;
    emitUpdate();
    scheduleFrame();
    return true;
  };

  /**
   * Start one discrete adjacent step. Repeated steps are rejected until settle.
   * @param {number} nextDirection
   * @param {{source?: string}} [meta]
   * @returns {boolean}
   */
  const step = (nextDirection, { source: nextSource = 'button' } = {}) => {
    if (destroyed || pauseReasons.size || !settled || count < 2) return false;
    const normalizedDirection = Number(nextDirection) < 0 ? -1 : 1;
    const index = wrapIndex(currentIndex + normalizedDirection, count);
    if (config.reducedMotion) {
      return settleImmediately(index, nextSource, 'reduced-motion-step');
    }
    beginPair(index, normalizedDirection, nextSource, 'discrete');
    return true;
  };

  /**
   * Move toward a work index. A direct move creates exactly one current/target
   * pair even when the cyclic index is not adjacent. A non-direct move selects
   * only the first adjacent step along the shortest cyclic direction.
   *
   * `goTo` may interrupt existing motion. The visually dominant work becomes
   * the new stable origin before the requested pair starts.
   *
   * @param {number} index
   * @param {{source?: string, direct?: boolean}} [meta]
   * @returns {boolean}
   */
  const goTo = (index, { source: nextSource = 'hash', direct = true } = {}) => {
    if (destroyed || count < 1) return false;
    const requestedIndex = wrapIndex(asFiniteNumber(index, currentIndex), count);

    if (!settled) {
      const oldCurrent = currentIndex;
      const rebasedIndex = dominantIndex;
      const changed = rebasedIndex !== oldCurrent;
      resetStableState(rebasedIndex, nextSource);
      if (changed) {
        onCommit(rebasedIndex, eventMeta('interrupt-rebase', {
          fromIndex: oldCurrent,
          toIndex: rebasedIndex,
          committed: true,
          direct: true,
        }));
      }
      emitUpdate();
    }

    if (requestedIndex === currentIndex) {
      source = String(nextSource || 'hash');
      emitUpdate();
      onSettle(currentIndex, eventMeta('already-current', { committed: false, direct }));
      return false;
    }

    const nextDirection = shortestDirection(requestedIndex);
    const pairTarget = direct
      ? requestedIndex
      : wrapIndex(currentIndex + nextDirection, count);
    if (config.reducedMotion) {
      return settleImmediately(pairTarget, nextSource, 'reduced-motion-go-to', direct);
    }
    beginPair(pairTarget, nextDirection, nextSource, direct ? 'direct' : 'discrete');
    return true;
  };

  /** Freeze motion without changing its current visual position. */
  const pause = (reason = 'manual') => {
    if (destroyed) return false;
    const normalizedReason = String(reason || 'manual');
    const sizeBefore = pauseReasons.size;
    pauseReasons.add(normalizedReason);
    latestPauseReason = normalizedReason;
    stopFrame();
    emitUpdate();
    return pauseReasons.size !== sizeBefore;
  };

  /** Resume one pause reason. Motion resumes only after every reason is gone. */
  const resume = (reason = 'manual') => {
    if (destroyed) return false;
    const normalizedReason = String(reason || 'manual');
    const removed = pauseReasons.delete(normalizedReason);
    latestPauseReason = pauseReasons.size ? [...pauseReasons].at(-1) : null;
    if (!pauseReasons.size && !settled) {
      lastFrameTime = null;
      scheduleFrame();
    }
    emitUpdate();
    return removed;
  };

  /**
   * Stop accepting free momentum and spring to the predicted nearest boundary.
   * @returns {boolean} Whether a snap is active or completed.
   */
  const snapToNearest = () => {
    if (destroyed || settled) return false;
    if (config.reducedMotion) {
      const destination = chooseSnapDestination();
      if (destination === 0) settleAtOrigin('reduced-motion-snap');
      else commitAndSettle('reduced-motion-snap');
      return true;
    }
    beginSnap();
    lastFrameTime = null;
    emitUpdate();
    scheduleFrame();
    return true;
  };

  /**
   * Replace the cycle size and settle immediately on `activeIndex` (or the
   * wrapped current index). No intermediate work is visited.
   */
  const updateCount = (nextCount, { activeIndex } = {}) => {
    if (destroyed) return false;
    const normalizedCount = Math.max(1, Math.trunc(asFiniteNumber(nextCount, count)));
    const previousIndex = currentIndex;
    const previousDominantIndex = dominantIndex;
    count = normalizedCount;
    const requestedIndex = activeIndex === undefined ? previousIndex : activeIndex;
    const normalizedIndex = wrapIndex(asFiniteNumber(requestedIndex, 0), count);
    source = 'count-update';
    resetStableState(normalizedIndex, source);
    if (dominantIndex !== previousDominantIndex) {
      onDominantChange(dominantIndex, eventMeta('count-update'));
    }
    emitUpdate();
    onSettle(currentIndex, eventMeta('count-update', {
      previousIndex,
      committed: currentIndex !== previousIndex,
    }));
    return true;
  };

  /** Cancel the RAF and permanently disable the controller. */
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stopFrame();
    pauseReasons.clear();
  };

  const controller = Object.freeze({
    impulse,
    step,
    goTo,
    pause,
    resume,
    snapToNearest,
    updateCount,
    getSnapshot,
    destroy,
  });

  emitUpdate();
  return controller;
}

export default createDetailMotionController;
