import './transition.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

const wrap = (value, length) => {
  if (!length) return 0;
  return ((value % length) + length) % length;
};

const setText = (node, value = '') => {
  if (node) node.textContent = String(value);
};

const findWork = (project, workId, labMode) => {
  const works = Array.isArray(project?.works) ? project.works : [];
  if (labMode) return works[0] || null;
  return works.find((work) => work.id === workId) || works[0] || null;
};

const normalizeClips = (work) => {
  const clips = Array.isArray(work?.clips) ? work.clips.filter(Boolean) : [];
  if (clips.length) return clips;
  return [
    {
      id: 'missing-clip',
      title: 'MEDIA REQUIRED',
      src: '',
      poster: '',
      tone: work?.accent || '#20252b',
      status: 'missing',
      note: '这里还没有视频素材。',
    },
  ];
};

const createLayer = (name) => {
  const layer = document.createElement('div');
  layer.className = `tx-media-layer tx-media-layer--${name}`;
  layer.dataset.layer = name;

  const video = document.createElement('video');
  video.className = 'tx-video';
  video.muted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.setAttribute('aria-hidden', 'true');

  const fallback = document.createElement('div');
  fallback.className = 'tx-media-fallback';
  fallback.setAttribute('aria-hidden', 'true');

  const grain = document.createElement('div');
  grain.className = 'tx-media-grain';
  grain.setAttribute('aria-hidden', 'true');

  layer.append(video, fallback, grain);
  return { layer, video, fallback, clipIndex: -1 };
};

const clearVideo = (slot) => {
  slot.video.pause();
  slot.video.removeAttribute('src');
  slot.video.removeAttribute('poster');
  slot.video.load();
  slot.clipIndex = -1;
};

const prepareSlot = (slot, clip, clipIndex, shouldPlay = false) => {
  slot.clipIndex = clipIndex;
  slot.layer.dataset.assetStatus = clip.status || 'missing';
  slot.fallback.style.setProperty('--clip-tone', clip.tone || '#293038');

  const nextSrc = String(clip.src || '');
  const currentSrc = slot.video.getAttribute('src') || '';
  if (currentSrc !== nextSrc) {
    if (nextSrc) slot.video.setAttribute('src', nextSrc);
    else slot.video.removeAttribute('src');

    if (clip.poster) slot.video.setAttribute('poster', clip.poster);
    else slot.video.removeAttribute('poster');

    slot.video.load();
  }

  slot.video.preload = shouldPlay ? 'auto' : 'metadata';
  if (shouldPlay && nextSrc) {
    slot.video.play().catch(() => {
      // Some browsers still require one user gesture. The fallback stays visible.
    });
  } else {
    slot.video.pause();
  }
};

const animateElement = (node, keyframes, options) => {
  const animation = node.animate(keyframes, { fill: 'both', ...options });
  return animation;
};

export function mountTransition({ root, project, workId, labMode = false, onBack } = {}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError('mountTransition 需要一个有效的 root 元素。');
  }

  let activeProject = project || { works: [], motion: {} };
  let activeWork = findWork(activeProject, workId, labMode);
  let clips = normalizeClips(activeWork);
  let activeIndex = 0;
  let currentSlot;
  let preloadSlot;
  let destroyed = false;
  let isTransitioning = false;
  let queuedDirection = 0;
  let wheelDistance = 0;
  let wheelResetTimer = 0;
  let transitionToken = 0;
  const runningAnimations = new Set();

  root.innerHTML = `
    <section class="tx-experience" aria-label="作品视频转场试验">
      <div class="tx-stage" aria-live="off"></div>
      <div class="tx-vignette" aria-hidden="true"></div>
      <div class="tx-slice" aria-hidden="true"></div>

      <header class="tx-header">
        <button class="tx-back" type="button">
          <span class="tx-back-line" aria-hidden="true"></span>
          <span>BACK TO GALLERY</span>
        </button>
        <div class="tx-brand" aria-label="Flowframe transition study">FLOWFRAME <i></i> VISUAL STUDY</div>
        <div class="tx-mode"><strong>LAB</strong><span>TRANSITION / 01</span></div>
      </header>

      <main class="tx-copy">
        <div class="tx-copy-motion">
          <p class="tx-kicker"></p>
          <div class="tx-title-mask"><h1 class="tx-title"></h1></div>
          <div class="tx-description-mask"><p class="tx-description"></p></div>
        </div>
        <div class="tx-status-row">
          <span class="tx-placeholder">PLACEHOLDER MEDIA</span>
          <span class="tx-asset-note">程序生成片段，仅用于验证镜头转场，不是最终素材。</span>
        </div>
      </main>

      <aside class="tx-progress" aria-label="片段列表">
        <ol class="tx-progress-list"></ol>
      </aside>

      <footer class="tx-footer">
        <div class="tx-counter"><span class="tx-current-number">01</span><i></i><span class="tx-total-number">03</span></div>
        <p class="tx-instruction">SCROLL / ARROW KEYS</p>
        <div class="tx-controls">
          <button class="tx-control tx-control--prev" type="button" aria-label="上一个片段">PREV</button>
          <button class="tx-control tx-control--next" type="button" aria-label="下一个片段">NEXT</button>
        </div>
      </footer>
    </section>
  `;

  const experience = root.querySelector('.tx-experience');
  const stage = root.querySelector('.tx-stage');
  const slice = root.querySelector('.tx-slice');
  const copyMotion = root.querySelector('.tx-copy-motion');
  const kicker = root.querySelector('.tx-kicker');
  const title = root.querySelector('.tx-title');
  const description = root.querySelector('.tx-description');
  const assetNote = root.querySelector('.tx-asset-note');
  const currentNumber = root.querySelector('.tx-current-number');
  const totalNumber = root.querySelector('.tx-total-number');
  const progressList = root.querySelector('.tx-progress-list');
  const backButton = root.querySelector('.tx-back');
  const prevButton = root.querySelector('.tx-control--prev');
  const nextButton = root.querySelector('.tx-control--next');

  currentSlot = createLayer('current');
  preloadSlot = createLayer('preload');
  stage.append(currentSlot.layer, preloadSlot.layer);

  const trackAnimation = (animation) => {
    runningAnimations.add(animation);
    const cleanup = () => runningAnimations.delete(animation);
    animation.addEventListener('finish', cleanup, { once: true });
    animation.addEventListener('cancel', cleanup, { once: true });
    return animation;
  };

  const getMotion = () => {
    const source = activeProject?.motion || {};
    return {
      duration: clamp(source.transitionDuration ?? 1.1, 0.55, 3.2) * 1000,
      distortion: clamp(source.transitionDistortion ?? 0.92, 0, 1),
      scale: clamp(source.transitionScale ?? 1.2, 1, 1.35),
      blur: clamp(source.transitionBlur ?? 14, 0, 24),
      angle: clamp(source.transitionMaskAngle ?? -22, -35, 35),
      textDelay: clamp(source.transitionTextDelay ?? 0.12, 0, 0.9) * 1000,
    };
  };

  const renderProgress = () => {
    progressList.replaceChildren();
    clips.forEach((clip, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const number = document.createElement('span');
      const label = document.createElement('span');
      const line = document.createElement('i');

      button.type = 'button';
      button.className = 'tx-progress-button';
      button.dataset.clipIndex = String(index);
      button.setAttribute('aria-label', `切换到片段 ${index + 1}：${clip.title || ''}`);
      button.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      number.className = 'tx-progress-number';
      label.className = 'tx-progress-label';
      number.textContent = String(index + 1).padStart(2, '0');
      label.textContent = clip.title || `CLIP ${index + 1}`;
      button.append(number, line, label);
      item.append(button);
      progressList.append(item);
    });
  };

  const renderCopy = (index) => {
    const clip = clips[index];
    const workNumber = activeWork?.index || String((activeWork?.order || 1)).padStart(2, '0');
    setText(kicker, `${workNumber} / ${activeWork?.category || 'MOTION STUDY'} — CLIP ${String(index + 1).padStart(2, '0')}`);
    setText(title, clip.title || activeWork?.titleEn || activeWork?.title || 'UNTITLED');
    setText(description, activeWork?.description || clip.note || '视频片段转场试验。');
    setText(assetNote, clip.note || '此片段用于转场验证，不是最终素材。');
    setText(currentNumber, String(index + 1).padStart(2, '0'));
    setText(totalNumber, String(clips.length).padStart(2, '0'));

    root.querySelectorAll('.tx-progress-button').forEach((button) => {
      button.setAttribute('aria-current', Number(button.dataset.clipIndex) === index ? 'true' : 'false');
    });
  };

  const preloadFollowing = () => {
    if (clips.length < 2) {
      clearVideo(preloadSlot);
      return;
    }
    const nextIndex = wrap(activeIndex + 1, clips.length);
    prepareSlot(preloadSlot, clips[nextIndex], nextIndex, false);
  };

  const settleSlots = () => {
    currentSlot.layer.className = 'tx-media-layer tx-media-layer--current';
    currentSlot.layer.style.removeProperty('z-index');
    currentSlot.layer.getAnimations().forEach((animation) => animation.cancel());
    currentSlot.layer.style.clipPath = 'inset(0)';
    currentSlot.layer.style.transform = 'none';
    currentSlot.layer.style.filter = 'none';
    currentSlot.layer.style.opacity = '1';

    preloadSlot.layer.className = 'tx-media-layer tx-media-layer--preload';
    preloadSlot.layer.style.removeProperty('z-index');
    preloadSlot.layer.getAnimations().forEach((animation) => animation.cancel());
    preloadSlot.layer.style.removeProperty('clip-path');
    preloadSlot.layer.style.removeProperty('transform');
    preloadSlot.layer.style.removeProperty('filter');
    preloadSlot.layer.style.removeProperty('opacity');
  };

  const finishTransition = (nextIndex, incomingSlot, outgoingSlot, token) => {
    if (destroyed || token !== transitionToken) return;

    outgoingSlot.video.pause();
    currentSlot = incomingSlot;
    preloadSlot = outgoingSlot;
    activeIndex = nextIndex;
    renderCopy(activeIndex);
    settleSlots();
    preloadFollowing();
    isTransitioning = false;
    experience.classList.remove('is-transitioning');

    if (queuedDirection) {
      const direction = queuedDirection;
      queuedDirection = 0;
      requestAnimationFrame(() => transition(direction));
    }
  };

  const transition = (direction = 1, requestedIndex = null) => {
    if (destroyed || clips.length < 2) return;

    const normalizedDirection = direction < 0 ? -1 : 1;
    const nextIndex = requestedIndex === null
      ? wrap(activeIndex + normalizedDirection, clips.length)
      : wrap(requestedIndex, clips.length);

    if (nextIndex === activeIndex) return;
    if (isTransitioning) {
      queuedDirection = normalizedDirection;
      return;
    }

    isTransitioning = true;
    queuedDirection = 0;
    const token = ++transitionToken;
    const motion = getMotion();
    const outgoingSlot = currentSlot;
    const incomingSlot = preloadSlot;
    const xSign = normalizedDirection > 0 ? 1 : -1;
    const angleSign = motion.angle * xSign;
    const travel = 6 + motion.distortion * 10;
    const skew = 1.5 + motion.distortion * 4.5;
    const directionName = normalizedDirection > 0 ? 'next' : 'previous';

    prepareSlot(incomingSlot, clips[nextIndex], nextIndex, true);
    incomingSlot.layer.className = `tx-media-layer tx-media-layer--incoming is-${directionName}`;
    outgoingSlot.layer.className = `tx-media-layer tx-media-layer--outgoing is-${directionName}`;
    incomingSlot.layer.style.zIndex = '3';
    outgoingSlot.layer.style.zIndex = '2';
    experience.classList.add('is-transitioning');
    slice.style.setProperty('--slice-angle', `${angleSign}deg`);

    const startClip = normalizedDirection > 0
      ? `polygon(112% 0, 112% 0, ${88 + angleSign * 0.18}% 100%, ${88 + angleSign * 0.18}% 100%)`
      : `polygon(-12% 0, -12% 0, ${12 + angleSign * 0.18}% 100%, ${12 + angleSign * 0.18}% 100%)`;
    const middleClip = normalizedDirection > 0
      ? `polygon(${40 - angleSign * 0.16}% 0, 112% 0, 112% 100%, ${62 - angleSign * 0.16}% 100%)`
      : `polygon(-12% 0, ${60 - angleSign * 0.16}% 0, ${38 - angleSign * 0.16}% 100%, -12% 100%)`;

    const outgoingAnimation = trackAnimation(animateElement(outgoingSlot.layer, [
      { transform: 'scale(1) translate3d(0, 0, 0)', filter: 'blur(0px) saturate(1)', opacity: 1 },
      {
        offset: 0.58,
        transform: `scale(${1 + (motion.scale - 1) * 0.62}) translate3d(${-xSign * travel * 0.34}vw, -0.8vh, 0) skewX(${xSign * skew * 0.55}deg)`,
        filter: `blur(${motion.blur * 0.45}px) saturate(${1 - motion.distortion * 0.18})`,
        opacity: 0.96,
      },
      {
        transform: `scale(${motion.scale}) translate3d(${-xSign * travel}vw, -1.8vh, 0) skewX(${xSign * skew}deg)`,
        filter: `blur(${motion.blur}px) saturate(${1 - motion.distortion * 0.3})`,
        opacity: 0.45,
      },
    ], {
      duration: motion.duration,
      easing: 'cubic-bezier(.58, 0, .2, 1)',
    }));

    const incomingAnimation = trackAnimation(animateElement(incomingSlot.layer, [
      {
        clipPath: startClip,
        transform: `scale(${Math.max(0.82, 2 - motion.scale)}) translate3d(${xSign * travel * 0.72}vw, 1.8vh, 0) skewX(${-xSign * skew}deg)`,
        filter: `blur(${motion.blur}px) brightness(.72) saturate(${1 + motion.distortion * 0.25})`,
      },
      {
        offset: 0.54,
        clipPath: middleClip,
        transform: `scale(${1 + (motion.scale - 1) * 0.2}) translate3d(${xSign * travel * 0.18}vw, .5vh, 0) skewX(${-xSign * skew * 0.3}deg)`,
        filter: `blur(${motion.blur * 0.28}px) brightness(.9) saturate(1.06)`,
      },
      {
        clipPath: 'polygon(-12% 0, 112% 0, 112% 100%, -12% 100%)',
        transform: 'scale(1) translate3d(0, 0, 0) skewX(0deg)',
        filter: 'blur(0px) brightness(1) saturate(1)',
      },
    ], {
      duration: motion.duration,
      easing: 'cubic-bezier(.66, 0, .12, 1)',
    }));

    trackAnimation(animateElement(slice, [
      { opacity: 0, transform: `translate3d(${xSign * 58}vw, 0, 0) skewX(${angleSign}deg) scaleX(.12)` },
      { offset: 0.4, opacity: 0.3, transform: `translate3d(${xSign * 8}vw, 0, 0) skewX(${angleSign}deg) scaleX(.36)` },
      { opacity: 0, transform: `translate3d(${-xSign * 62}vw, 0, 0) skewX(${angleSign}deg) scaleX(.08)` },
    ], {
      duration: motion.duration * 0.78,
      easing: 'cubic-bezier(.7, 0, .24, 1)',
    }));

    const copyOut = trackAnimation(animateElement(copyMotion, [
      { opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0px)' },
      { opacity: 0, transform: `translate3d(${-xSign * 3.5}vw, -1.2vh, 0)`, filter: 'blur(4px)' },
    ], {
      duration: Math.min(390, motion.duration * 0.32),
      easing: 'cubic-bezier(.55, 0, .65, 1)',
    }));

    Promise.allSettled([outgoingAnimation.finished, incomingAnimation.finished, copyOut.finished]).then(() => {
      if (destroyed || token !== transitionToken) return;
      renderCopy(nextIndex);

      const copyIn = trackAnimation(animateElement(copyMotion, [
        { opacity: 0, transform: `translate3d(${xSign * 2.8}vw, 2vh, 0)`, filter: 'blur(5px)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0px)' },
      ], {
        delay: motion.textDelay,
        duration: Math.min(620, motion.duration * 0.5),
        easing: 'cubic-bezier(.22, 1, .36, 1)',
      }));

      copyIn.finished.finally(() => finishTransition(nextIndex, incomingSlot, outgoingSlot, token));
    });
  };

  const onWheel = (event) => {
    if (destroyed || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    wheelDistance += event.deltaY;
    window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => {
      wheelDistance = 0;
    }, 180);

    if (Math.abs(wheelDistance) < 42) return;
    const direction = wheelDistance > 0 ? 1 : -1;
    wheelDistance = 0;
    transition(direction);
  };

  const onKeyDown = (event) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      transition(1);
    }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      transition(-1);
    }
    if (event.key === 'Escape') backButton.click();
  };

  const onProgressClick = (event) => {
    const button = event.target.closest('.tx-progress-button');
    if (!button || !progressList.contains(button)) return;
    const requestedIndex = Number(button.dataset.clipIndex);
    if (!Number.isInteger(requestedIndex) || requestedIndex === activeIndex) return;
    const forwardDistance = wrap(requestedIndex - activeIndex, clips.length);
    const backwardDistance = wrap(activeIndex - requestedIndex, clips.length);
    transition(forwardDistance <= backwardDistance ? 1 : -1, requestedIndex);
  };

  const handleBack = () => {
    if (typeof onBack === 'function') onBack();
    else window.location.hash = '#/';
  };

  backButton.addEventListener('click', handleBack);
  prevButton.addEventListener('click', () => transition(-1));
  nextButton.addEventListener('click', () => transition(1));
  progressList.addEventListener('click', onProgressClick);
  experience.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);

  renderProgress();
  renderCopy(activeIndex);
  prepareSlot(currentSlot, clips[activeIndex], activeIndex, true);
  preloadFollowing();
  requestAnimationFrame(() => experience.classList.add('is-ready'));

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      transitionToken += 1;
      window.clearTimeout(wheelResetTimer);
      runningAnimations.forEach((animation) => animation.cancel());
      runningAnimations.clear();
      backButton.removeEventListener('click', handleBack);
      progressList.removeEventListener('click', onProgressClick);
      experience.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      clearVideo(currentSlot);
      clearVideo(preloadSlot);
      root.replaceChildren();
    },

    updateProject(nextProject) {
      if (destroyed) return;
      transitionToken += 1;
      runningAnimations.forEach((animation) => animation.cancel());
      runningAnimations.clear();
      isTransitioning = false;
      queuedDirection = 0;

      const previousClipId = clips[activeIndex]?.id;
      activeProject = nextProject || activeProject;
      activeWork = findWork(activeProject, workId, labMode);
      clips = normalizeClips(activeWork);
      const matchingIndex = clips.findIndex((clip) => clip.id === previousClipId);
      activeIndex = matchingIndex >= 0 ? matchingIndex : 0;

      experience.classList.remove('is-transitioning');
      renderProgress();
      renderCopy(activeIndex);
      prepareSlot(currentSlot, clips[activeIndex], activeIndex, true);
      settleSlots();
      preloadFollowing();
    },
  };
}

export default mountTransition;
