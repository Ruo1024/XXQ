import { resolveWorkMedia, sanitizeProject } from '../data/project-contract.js';
import { createDetailMotionController } from './detail-motion-controller.js';
import { createDetailWebGLRenderer } from './detail-webgl-renderer.js';
import './work-detail.css';

export const DETAIL_STATES = Object.freeze({
  intro: 'intro',
  idle: 'idle',
  switching: 'switching',
  info: 'info',
  playing: 'playing',
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

const wrap = (value, length) => {
  if (!length) return 0;
  return ((Math.trunc(value) % length) + length) % length;
};

const assetLabel = (status) => {
  if (status === 'final') return '';
  if (status === 'missing') return 'MISSING MEDIA';
  return 'PLACEHOLDER MEDIA';
};

const clearVideo = (video) => {
  video.pause();
  video.loop = false;
  video.removeAttribute('src');
  video.removeAttribute('poster');
  delete video.dataset.playlistIndex;
  delete video.dataset.playlistLength;
  video.load();
};

const getWheelPixels = (event, viewportHeight) => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * viewportHeight;
  return event.deltaY;
};

export function mountWorkDetail({
  root,
  project,
  workId,
  onBack,
  onWorkIdChange,
  audioController,
} = {}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError('mountWorkDetail 需要有效的 root 元素。');
  }

  let activeProject = sanitizeProject(project);
  let works = activeProject.works;
  const requestedIndex = works.findIndex((work) => work.id === workId);
  let initialIndex = requestedIndex >= 0 ? requestedIndex : 0;
  let detailState = DETAIL_STATES.intro;
  let destroyed = false;
  let introTimer = 0;
  let transitionToken = 0;
  let pairKey = '';
  let pendingPairKey = '';
  let pendingPairPromise = null;
  let pendingMediaImpulse = 0;
  let visualHoldProgress = null;
  let lastMotionSnapshot = null;
  let motionController = null;
  let renderer = null;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const createMotionConfig = (sourceProject) => {
    const transitionDuration = clamp(sourceProject.motion?.transitionDuration ?? 1.1, 0.55, 3.2);
    return Object.freeze({
      impulseGain: 0.014,
      stepVelocity: clamp(1.55 / transitionDuration, 0.62, 2.05),
      directVelocity: clamp(1.42 / transitionDuration, 0.56, 1.92),
      maxVelocity: 2.9,
      friction: 4.45,
      springStrength: clamp(sourceProject.motion?.transitionSpring ?? 42, 14, 90),
      springDamping: clamp(sourceProject.motion?.transitionDamping ?? 9.2, 3, 18),
      predictionSeconds: 0.25,
      inputIdleMs: 105,
      maxDeltaSeconds: 1 / 30,
      reducedMotion,
    });
  };
  let motionConfig = createMotionConfig(activeProject);
  const inkFilterId = `flowframe-play-ink-${Math.random().toString(36).slice(2, 9)}`;

  root.innerHTML = `
    <section class="work-detail" data-detail-state="intro" aria-label="FLOWFRAME 作品详情">
      <div class="work-visual-stage" aria-live="off"></div>
      <div class="work-visual-vignette" aria-hidden="true"></div>
      <div class="work-visual-mask" aria-hidden="true"></div>
      <div class="work-grain" aria-hidden="true"></div>

      <header class="work-hud">
        <button class="work-back" type="button" data-detail-back>
          <span>FLOWFRAME</span><i aria-hidden="true"></i><em>BACK</em>
        </button>
        <span class="work-hud__section">SELECTED WORK / MOTION ARCHIVE</span>
        <div class="work-hud__actions">
          <button class="work-sound" type="button" data-detail-sound aria-pressed="true">SOUND ON</button>
          <span class="work-hud__status" data-detail-header-status>PLACEHOLDER MEDIA</span>
        </div>
      </header>

      <button class="work-menu-mark" type="button" data-detail-menu aria-label="返回作品集">
        <i></i><i></i><i></i>
      </button>

      <main class="work-copy">
        <div class="work-copy-motion">
          <div class="work-copy__text">
            <p class="work-kicker" data-detail-kicker>—</p>
            <p class="work-title-local" data-detail-title-local>—</p>
            <h1 data-detail-title>—</h1>
            <p class="work-logline" data-detail-logline>—</p>
            <button class="work-info-button" type="button" data-detail-info>INFO</button>
            <div class="work-asset-row">
              <span class="work-asset-badge" data-detail-asset>PLACEHOLDER MEDIA</span>
              <span data-detail-media-note>本地测试媒体，仅用于验证详情体验。</span>
            </div>
          </div>
          <button class="work-play" type="button" data-detail-play aria-label="播放当前作品">
            <svg class="work-play__filter" width="0" height="0" aria-hidden="true" focusable="false">
              <filter id="${inkFilterId}" x="-28%" y="-28%" width="156%" height="156%">
                <feTurbulence type="fractalNoise" baseFrequency="0.018 0.026" numOctaves="2" seed="7" result="ink-noise"></feTurbulence>
                <feDisplacementMap data-play-ink-displacement in="SourceGraphic" in2="ink-noise" scale="8" xChannelSelector="R" yChannelSelector="B"></feDisplacementMap>
              </filter>
            </svg>
            <span class="work-play__ink" style="filter:url(#${inkFilterId})" aria-hidden="true"></span>
            <span class="work-play__label">PLAY</span><i aria-hidden="true"></i>
          </button>
        </div>
      </main>

      <nav class="work-navi" aria-label="作品前后导航">
        <button class="work-navi__item work-navi__item--prev" type="button" data-detail-prev>
          <span data-detail-prev-number>#000</span><strong data-detail-prev-title>PREVIOUS</strong><i aria-hidden="true"></i>
        </button>
        <span class="work-navi__count" data-detail-count>001 / 005</span>
        <button class="work-navi__item work-navi__item--next" type="button" data-detail-next>
          <span data-detail-next-number>#002</span><strong data-detail-next-title>NEXT</strong><i aria-hidden="true"></i>
        </button>
      </nav>

      <aside class="work-info" aria-hidden="true" data-detail-info-panel>
        <button class="work-overlay-close" type="button" data-detail-info-close aria-label="关闭作品信息">CLOSE <i></i></button>
        <div class="work-info__inner">
          <p class="work-info__number" data-info-number>#001 / INFORMATION</p>
          <h2 data-info-title>—</h2>
          <p class="work-info__meta" data-info-meta>—</p>
          <p class="work-info__description" data-info-description>—</p>
          <section data-info-section="0">
            <span data-info-section-label="0">CHARACTERS</span>
            <p data-info-section-body="0">—</p>
          </section>
          <section data-info-section="1">
            <span data-info-section-label="1">VISUAL NOTE</span>
            <p data-info-section-body="1">—</p>
          </section>
          <p class="work-info__asset" data-info-asset>PLACEHOLDER MEDIA / 未完成授权核验的测试媒体</p>
        </div>
      </aside>

      <section class="work-player" aria-hidden="true" data-detail-player>
        <button class="work-overlay-close work-player__close" type="button" data-detail-player-close aria-label="关闭播放器">CLOSE <i></i></button>
        <div class="work-player__status">
          <span data-player-number>MIX 001 / PLAYING</span>
          <strong data-player-asset>PLACEHOLDER MEDIA</strong>
        </div>
        <video class="work-player__video" controls playsinline data-detail-player-video></video>
        <div class="work-player__missing" data-player-missing hidden>
          <strong>MEDIA REQUIRED</strong>
          <span>这个作品还没有可播放的视频。</span>
        </div>
      </section>
    </section>
  `;

  const experience = root.querySelector('.work-detail');
  const stage = root.querySelector('.work-visual-stage');
  const visualMask = root.querySelector('.work-visual-mask');
  const copyMotion = root.querySelector('.work-copy-motion');
  const backButton = root.querySelector('[data-detail-back]');
  const menuButton = root.querySelector('[data-detail-menu]');
  const prevButton = root.querySelector('[data-detail-prev]');
  const nextButton = root.querySelector('[data-detail-next]');
  const playButton = root.querySelector('[data-detail-play]');
  const infoButton = root.querySelector('[data-detail-info]');
  const infoPanel = root.querySelector('[data-detail-info-panel]');
  const infoClose = root.querySelector('[data-detail-info-close]');
  const player = root.querySelector('[data-detail-player]');
  const playerClose = root.querySelector('[data-detail-player-close]');
  const playerVideo = root.querySelector('[data-detail-player-video]');
  const playerMissing = root.querySelector('[data-player-missing]');
  const soundButton = root.querySelector('[data-detail-sound]');
  const playInk = root.querySelector('.work-play__ink');
  const inkDisplacement = root.querySelector('[data-play-ink-displacement]');
  const interactiveButtons = [prevButton, nextButton, playButton, infoButton];
  let playerSources = [];
  let playerSourceIndex = 0;
  let inkDelayTimer = 0;
  let inkResetTimer = 0;
  let inkPointerFrame = 0;
  let inkPointerInside = false;
  let inkOrigin = { x: 50, y: 50 };
  let inkTarget = { x: 50, y: 50 };

  const getInkConfig = () => ({
    delay: clamp(activeProject.motion?.playInkDelay ?? 0.09, 0, 0.3),
    duration: clamp(activeProject.motion?.playInkDuration ?? 0.48, 0.18, 1.2),
    elastic: clamp(activeProject.motion?.playInkElastic ?? 0.72, 0, 1.5),
    distortion: clamp(activeProject.motion?.playInkDistortion ?? 0.18, 0, 0.45),
  });

  const syncInkConfig = () => {
    const config = getInkConfig();
    playButton.style.setProperty('--play-ink-delay', `${reducedMotion ? 0 : config.delay}s`);
    playButton.style.setProperty('--play-ink-duration', `${reducedMotion ? 0.08 : config.duration}s`);
    playButton.style.setProperty('--play-ink-elastic', String(config.elastic));
    playButton.style.setProperty('--play-ink-stretch-x', String((config.elastic * 0.055).toFixed(4)));
    playButton.style.setProperty('--play-ink-squash-y', String((config.elastic * 0.038).toFixed(4)));
    playButton.style.setProperty('--play-ink-counter-x', String((config.elastic * 0.018).toFixed(4)));
    playButton.style.setProperty('--play-ink-counter-y', String((config.elastic * 0.025).toFixed(4)));
    playButton.style.setProperty('--play-ink-distortion', String(config.distortion));
    inkDisplacement?.setAttribute('scale', String(reducedMotion ? 0 : Math.round(config.distortion * 54)));
    playButton.dataset.inkDelay = String(config.delay);
    playButton.dataset.inkDuration = String(config.duration);
    playButton.dataset.inkElastic = String(config.elastic);
    playButton.dataset.inkDistortion = String(config.distortion);
  };

  const setInkPhase = (phase) => {
    playButton.dataset.inkPhase = phase;
    experience.dataset.playInkPhase = phase;
  };

  const applyInkOrigin = () => {
    inkPointerFrame = 0;
    inkOrigin.x += (inkTarget.x - inkOrigin.x) * 0.24;
    inkOrigin.y += (inkTarget.y - inkOrigin.y) * 0.24;
    playButton.style.setProperty('--play-ink-x', `${inkOrigin.x.toFixed(2)}%`);
    playButton.style.setProperty('--play-ink-y', `${inkOrigin.y.toFixed(2)}%`);
    playButton.dataset.inkOrigin = `${inkOrigin.x.toFixed(2)},${inkOrigin.y.toFixed(2)}`;
    if (Math.abs(inkTarget.x - inkOrigin.x) > 0.08 || Math.abs(inkTarget.y - inkOrigin.y) > 0.08) {
      inkPointerFrame = requestAnimationFrame(applyInkOrigin);
    }
  };

  const setInkOriginFromPointer = (event) => {
    const bounds = playButton.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    inkTarget = {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100),
    };
    if (!inkPointerFrame) inkPointerFrame = requestAnimationFrame(applyInkOrigin);
  };

  const beginInk = ({ x = 50, y = 50 } = {}) => {
    window.clearTimeout(inkDelayTimer);
    window.clearTimeout(inkResetTimer);
    inkTarget = { x, y };
    inkOrigin = { x, y };
    playInk.style.filter = reducedMotion ? 'none' : `url(#${inkFilterId})`;
    syncInkConfig();
    playButton.style.setProperty('--play-ink-x', `${x}%`);
    playButton.style.setProperty('--play-ink-y', `${y}%`);
    playButton.dataset.inkOrigin = `${x.toFixed(2)},${y.toFixed(2)}`;
    setInkPhase('waiting');
    const delay = reducedMotion ? 0 : getInkConfig().delay * 1000;
    inkDelayTimer = window.setTimeout(() => {
      inkDelayTimer = 0;
      if (inkPointerInside || document.activeElement === playButton) setInkPhase('expanded');
    }, delay);
  };

  const finalizeInkRetraction = () => {
    if (playButton.dataset.inkPhase !== 'retracting') return;
    window.clearTimeout(inkResetTimer);
    inkResetTimer = 0;
    playInk.style.filter = 'none';
    setInkPhase('idle');
  };

  const retractInk = () => {
    window.clearTimeout(inkDelayTimer);
    window.clearTimeout(inkResetTimer);
    inkDelayTimer = 0;
    const wasExpanded = playButton.dataset.inkPhase === 'expanded';
    setInkPhase(wasExpanded ? 'retracting' : 'idle');
    if (!wasExpanded) {
      playInk.style.filter = 'none';
      return;
    }
    const config = getInkConfig();
    const resetMs = reducedMotion ? 90 : config.duration * (0.72 + config.elastic * 0.22) * 1000;
    inkResetTimer = window.setTimeout(() => {
      finalizeInkRetraction();
    }, resetMs + 80);
  };

  const onPlayPointerEnter = (event) => {
    inkPointerInside = true;
    const bounds = playButton.getBoundingClientRect();
    beginInk({
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100),
    });
  };
  const onPlayPointerMove = (event) => {
    if (inkPointerInside) setInkOriginFromPointer(event);
  };
  const onPlayPointerLeave = () => {
    inkPointerInside = false;
    retractInk();
  };
  const onPlayFocus = () => {
    if (!inkPointerInside) beginInk({ x: 50, y: 50 });
  };
  const onPlayBlur = () => {
    if (!inkPointerInside) retractInk();
  };
  const onPlayInkAnimationEnd = (event) => {
    if (event.target === playButton && event.animationName === 'work-play-ink-elastic') {
      finalizeInkRetraction();
    }
  };
  const onPlayInkTransitionEnd = (event) => {
    if (event.target === playInk && event.propertyName === 'transform') finalizeInkRetraction();
  };

  syncInkConfig();
  setInkPhase('idle');
  playInk.style.filter = 'none';

  const updateSoundState = (state) => {
    const isOn = state === 'playing' || state === 'armed';
    const isUnavailable = state === 'missing' || state === 'error';
    soundButton.textContent = isUnavailable ? 'SOUND N/A' : isOn ? 'SOUND ON' : 'SOUND OFF';
    soundButton.setAttribute('aria-pressed', String(isOn));
    soundButton.dataset.soundState = state;
  };
  const unsubscribeSound = audioController?.subscribe?.(updateSoundState) || (() => {});
  const toggleSound = () => audioController?.toggle?.();
  const syncAudioTrack = (workIndex) => {
    const work = works[wrap(workIndex, works.length)];
    return audioController?.setTrack?.(work?.audioSrc, { id: work?.id });
  };

  const setDetailState = (nextState) => {
    if (destroyed || detailState === nextState) return;
    detailState = nextState;
    experience.dataset.detailState = nextState;
    experience.setAttribute('aria-busy', String(nextState === DETAIL_STATES.switching));
    interactiveButtons.forEach((button) => {
      button.disabled = nextState !== DETAIL_STATES.idle;
    });
  };

  const renderInfo = (work) => {
    root.querySelector('[data-info-number]').textContent = `#${work.number} / INFORMATION`;
    root.querySelector('[data-info-title]').textContent = work.titleEn || work.title;
    root.querySelector('[data-info-meta]').textContent = work.meta || `${work.category} / ${work.year}`;
    root.querySelector('[data-info-description]').textContent = work.infoDescription || work.description;
    const sections = Array.isArray(work.infoSections) ? work.infoSections.slice(0, 2) : [];
    root.querySelectorAll('[data-info-section]').forEach((section, index) => {
      const content = sections[index];
      section.hidden = !content;
      if (!content) return;
      section.querySelector('[data-info-section-label]').textContent = content.label;
      section.querySelector('[data-info-section-body]').textContent = content.body;
    });
    const infoAsset = root.querySelector('[data-info-asset]');
    const label = assetLabel(resolveWorkMedia(work).status) || 'FINAL MEDIA';
    infoAsset.textContent = `${label} / ${work.mediaNote || '未完成授权核验的测试媒体，仅用于本地视觉与交互验证。'}`;
  };

  const renderWork = (workIndex) => {
    const work = works[wrap(workIndex, works.length)];
    if (!work) return;
    const media = resolveWorkMedia(work);
    const previousWork = works[wrap(workIndex - 1, works.length)];
    const nextWork = works[wrap(workIndex + 1, works.length)];
    const label = assetLabel(media.status);

    experience.dataset.workId = work.id;
    experience.dataset.mediaStatus = media.status;
    experience.style.setProperty('--work-accent', work.accentColor || work.accent || '#8b9298');
    experience.classList.toggle('is-copy-right', work.copySide === 'right');
    root.querySelector('[data-detail-kicker]').textContent = `#${work.number} / ${work.category}`;
    root.querySelector('[data-detail-title-local]').textContent = work.title;
    root.querySelector('[data-detail-title]').textContent = work.titleEn || work.title;
    root.querySelector('[data-detail-logline]').textContent = work.shortDescription || work.description;
    root.querySelector('[data-detail-count]').textContent = `${work.number} / ${String(works.length).padStart(3, '0')}`;
    root.querySelector('[data-detail-prev-number]').textContent = `#${previousWork.number}`;
    root.querySelector('[data-detail-prev-title]').textContent = previousWork.titleEn || previousWork.title;
    root.querySelector('[data-detail-next-number]').textContent = `#${nextWork.number}`;
    root.querySelector('[data-detail-next-title]').textContent = nextWork.titleEn || nextWork.title;
    root.querySelector('[data-detail-header-status]').textContent = label || 'FINAL MEDIA';
    root.querySelector('[data-detail-media-note]').textContent = media.status === 'final'
      ? '已连接正式媒体。'
      : work.mediaNote || '未完成授权核验的测试媒体，仅用于本地视觉与交互验证。';

    const assetBadge = root.querySelector('[data-detail-asset]');
    assetBadge.textContent = label;
    assetBadge.hidden = !label;
    playButton.setAttribute('aria-label', `播放作品：${work.title}`);
    renderInfo(work);
  };

  const describeWork = (workIndex) => {
    const work = works[wrap(workIndex, works.length)];
    return {
      id: work.id,
      media: resolveWorkMedia(work),
      focalPoint: work.mediaFocalPoint || '50% 50%',
      accent: work.accentColor || work.accent || '#8b9298',
    };
  };

  const getPairIndices = (snapshot) => {
    const currentIndex = wrap(snapshot.currentIndex, works.length);
    const targetIndex = snapshot.isSettled
      ? wrap(currentIndex + 1, works.length)
      : wrap(snapshot.targetIndex, works.length);
    return { currentIndex, targetIndex };
  };

  const getPairKey = (snapshot) => {
    const { currentIndex, targetIndex } = getPairIndices(snapshot);
    return `${works[currentIndex]?.id || currentIndex}|${works[targetIndex]?.id || targetIndex}`;
  };

  const rendererVelocity = (snapshot) => {
    const distortion = clamp(activeProject.motion?.transitionDistortion ?? 0.92, 0.15, 1.5);
    return Math.abs(snapshot.velocity) * (0.78 + distortion * 0.92);
  };

  const syncRendererDataset = () => {
    const stats = renderer?.getStats?.() || {};
    const readySlots = [stats.current, stats.next].filter((slot) => slot?.ready);
    experience.dataset.rendererMode = stats.mode || 'unknown';
    experience.dataset.textureCount = String(readySlots.length);
    experience.dataset.rendererCurrentId = stats.current?.id || '';
    experience.dataset.rendererNextId = stats.next?.id || '';
    experience.dataset.transitionToken = String(transitionToken);
    experience.dataset.reducedMotion = String(reducedMotion);
    experience.dataset.transitionWaveStrength = String(stats.motion?.transitionWaveStrength ?? '');
    experience.dataset.transitionWaveFrequency = String(stats.motion?.transitionWaveFrequency ?? '');
    experience.dataset.transitionRowDelay = String(stats.motion?.transitionRowDelay ?? '');
    experience.dataset.transitionDepthShift = String(stats.motion?.transitionDepthShift ?? '');
    experience.dataset.transitionSpring = String(motionConfig.springStrength);
    experience.dataset.transitionDamping = String(motionConfig.springDamping);
  };

  const syncRendererPlayback = (reason = '') => {
    const paused = document.hidden || detailState === DETAIL_STATES.playing || reason === 'context-lost';
    renderer?.setPaused?.(paused);
    experience.dataset.rendererPaused = String(paused);
    experience.dataset.rendererPauseReason = paused
      ? (reason || (document.hidden ? 'hidden' : 'playing'))
      : (detailState === DETAIL_STATES.info ? 'info-background-playing' : 'none');
  };

  const syncMotionDataset = (snapshot) => {
    const scrollState = snapshot.isSettled ? 'idle' : snapshot.motionKind || 'switching';
    experience.dataset.scrollState = scrollState;
    experience.dataset.scrollProgress = snapshot.progress.toFixed(6);
    experience.dataset.scrollPosition = snapshot.position.toFixed(6);
    experience.dataset.scrollVelocity = snapshot.velocity.toFixed(6);
    experience.dataset.scrollDirection = String(snapshot.direction);
    experience.dataset.activeIndex = String(snapshot.dominantIndex);
    experience.dataset.targetIndex = String(snapshot.targetIndex);
    experience.dataset.isSettled = String(snapshot.isSettled);
    experience.dataset.controllerCount = snapshot.isSettled ? '0' : '1';
    experience.dataset.maxVelocity = String(motionConfig.maxVelocity);
    syncRendererDataset();
  };

  const applyCopyProgress = (snapshot) => {
    if (snapshot.isSettled) {
      copyMotion.style.removeProperty('opacity');
      copyMotion.style.removeProperty('transform');
      copyMotion.style.removeProperty('filter');
      visualMask.style.removeProperty('opacity');
      visualMask.style.removeProperty('transform');
      return;
    }

    const pulse = Math.sin(Math.PI * snapshot.progress);
    const direction = snapshot.direction || 1;
    copyMotion.style.opacity = String(clamp(1 - pulse * 0.82, 0.12, 1));
    copyMotion.style.transform = `translate3d(${direction * (snapshot.progress - 0.5) * 34}px, ${pulse * -13}px, 0) scale(${(1 - pulse * 0.035).toFixed(4)})`;
    copyMotion.style.filter = `blur(${(pulse * 4.2).toFixed(2)}px)`;
    visualMask.style.opacity = String(pulse * 0.23);
    visualMask.style.transform = `translate3d(${direction * (0.5 - snapshot.progress) * 60}vw,0,0) skewX(${direction * -18}deg)`;
  };

  const requestRendererPair = (snapshot, { holdProgress = visualHoldProgress } = {}) => {
    if (destroyed || !renderer || !works.length) return Promise.resolve(null);
    const desiredKey = getPairKey(snapshot);
    if (desiredKey === pairKey) {
      visualHoldProgress = null;
      syncRendererDataset();
      return Promise.resolve(renderer.getStats());
    }
    if (desiredKey === pendingPairKey && pendingPairPromise) return pendingPairPromise;

    const { currentIndex, targetIndex } = getPairIndices(snapshot);
    const token = ++transitionToken;
    const pauseForMedia = !snapshot.isSettled;
    pendingPairKey = desiredKey;
    if (pauseForMedia && !snapshot.isPaused) motionController?.pause('media');
    if (holdProgress !== null) {
      renderer.setProgress(holdProgress, {
        direction: snapshot.direction || 1,
        velocity: rendererVelocity(snapshot),
      });
    }
    syncRendererDataset();

    pendingPairPromise = renderer.setPair(
      describeWork(currentIndex),
      describeWork(targetIndex),
      { token },
    ).then((result) => {
      if (destroyed || result?.stale || token !== transitionToken) return result;
      pairKey = desiredKey;
      pendingPairKey = '';
      visualHoldProgress = null;
      const latest = motionController?.getSnapshot?.() || snapshot;
      renderer.setProgress(latest.isSettled ? 0 : latest.progress, {
        direction: latest.direction || 1,
        velocity: rendererVelocity(latest),
      });
      syncRendererPlayback();
      syncMotionDataset(latest);
      if (pauseForMedia) {
        motionController?.resume('media');
        if (pendingMediaImpulse) {
          const bufferedImpulse = pendingMediaImpulse;
          pendingMediaImpulse = 0;
          motionController?.impulse(bufferedImpulse, {
            source: 'wheel',
            time: performance.now(),
          });
        }
      }
      return result;
    }).catch(() => {
      if (token !== transitionToken) return null;
      pendingPairKey = '';
      visualHoldProgress = null;
      syncRendererDataset();
      if (pauseForMedia) {
        motionController?.resume('media');
        if (pendingMediaImpulse) {
          const bufferedImpulse = pendingMediaImpulse;
          pendingMediaImpulse = 0;
          motionController?.impulse(bufferedImpulse, {
            source: 'wheel',
            time: performance.now(),
          });
        }
      }
      return null;
    });
    return pendingPairPromise;
  };

  const handleMotionUpdate = (snapshot) => {
    if (destroyed) return;
    lastMotionSnapshot = snapshot;
    syncMotionDataset(snapshot);
    applyCopyProgress(snapshot);

    if (![DETAIL_STATES.intro, DETAIL_STATES.info, DETAIL_STATES.playing].includes(detailState)) {
      setDetailState(snapshot.isSettled ? DETAIL_STATES.idle : DETAIL_STATES.switching);
    }

    const desiredKey = getPairKey(snapshot);
    if (desiredKey === pairKey) {
      visualHoldProgress = null;
      renderer.setProgress(snapshot.isSettled ? 0 : snapshot.progress, {
        direction: snapshot.direction || 1,
        velocity: rendererVelocity(snapshot),
      });
      syncRendererDataset();
    } else {
      const holdProgress = visualHoldProgress;
      if (holdProgress === null) {
        renderer.setProgress(snapshot.isSettled ? 0 : snapshot.progress, {
          direction: snapshot.direction || 1,
          velocity: rendererVelocity(snapshot),
        });
      }
      requestRendererPair(snapshot, { holdProgress });
    }
  };

  const handleDominantChange = (index) => {
    renderWork(index);
  };

  const handleCommit = (_index, meta) => {
    if (!meta?.committed) return;
    visualHoldProgress = 1;
    renderer?.setProgress?.(1, {
      direction: meta.direction || 1,
      velocity: Math.abs(lastMotionSnapshot?.velocity || 0),
    });
    const snapshot = motionController?.getSnapshot?.();
    if (snapshot) requestRendererPair(snapshot, { holdProgress: 1 });
  };

  const handleSettle = (index, meta = {}) => {
    renderWork(index);
    syncAudioTrack(index);
    const snapshot = motionController?.getSnapshot?.();
    if (snapshot) requestRendererPair(snapshot, { holdProgress: meta.committed ? 1 : null });
    if (meta.committed && !['hash', 'count-update', 'initial'].includes(meta.source)) {
      onWorkIdChange?.(works[index].id, { replace: false, source: meta.source });
    }
    experience.dispatchEvent(new CustomEvent('flowframe:detail-settled', {
      detail: {
        workId: works[index]?.id,
        activeIndex: index,
        position: 0,
        direction: meta.direction || 0,
        reducedMotion,
      },
    }));
  };

  renderer = createDetailWebGLRenderer({
    host: stage,
    maxDpr: 1.6,
    reducedMotion,
    motion: activeProject.motion,
    onContextStateChange({ state }) {
      experience.dataset.webglState = state;
      if (state === 'lost') {
        motionController?.pause('webgl-context');
        syncRendererPlayback('context-lost');
      }
      if (state === 'restored') {
        motionController?.resume('webgl-context');
        syncRendererPlayback();
      }
      syncRendererDataset();
    },
  });

  renderWork(initialIndex);
  syncAudioTrack(initialIndex);
  const createMotionControllerForIndex = (index) => createDetailMotionController({
      count: works.length,
      initialIndex: index,
      config: motionConfig,
      onUpdate: handleMotionUpdate,
      onDominantChange: handleDominantChange,
      onCommit: handleCommit,
      onSettle: handleSettle,
    });
  motionController = createMotionControllerForIndex(initialIndex);
  lastMotionSnapshot = motionController.getSnapshot();
  const initialPairReady = requestRendererPair(lastMotionSnapshot);

  const getDebugSnapshot = () => {
    const snapshot = motionController?.getSnapshot?.() || lastMotionSnapshot || {};
    return {
      ...snapshot,
      detailState,
      scrollState: snapshot.isSettled ? 'idle' : snapshot.motionKind || 'switching',
      settledIndex: snapshot.currentIndex ?? initialIndex,
      semanticIndex: snapshot.dominantIndex ?? initialIndex,
      activeIndex: snapshot.dominantIndex ?? initialIndex,
      fromIndex: snapshot.currentIndex ?? initialIndex,
      toIndex: snapshot.targetIndex ?? initialIndex,
      transitionToken,
      maxVelocity: motionConfig.maxVelocity,
      controllerCount: snapshot.isSettled ? 0 : 1,
      reducedMotion,
    };
  };

  const getDebugRendererStats = () => {
    const stats = renderer?.getStats?.() || {};
    const textureCount = [stats.current, stats.next].filter((slot) => slot?.ready).length;
    return {
      ...stats,
      textureCount,
      activeTextureCount: textureCount,
      readyTextureCount: textureCount,
      fromIndex: getDebugSnapshot().fromIndex,
      toIndex: getDebugSnapshot().toIndex,
    };
  };

  const debugApi = Object.freeze({
    getSnapshot: getDebugSnapshot,
    getRendererStats: getDebugRendererStats,
  });
  window.__FLOWFRAME_DETAIL_DEBUG__ = debugApi;

  const loadPlayerSource = (index, { play = true } = {}) => {
    if (!playerSources.length) return false;
    playerSourceIndex = wrap(index, playerSources.length);
    playerVideo.src = playerSources[playerSourceIndex];
    playerVideo.loop = playerSources.length === 1;
    playerVideo.dataset.playlistIndex = String(playerSourceIndex);
    playerVideo.dataset.playlistLength = String(playerSources.length);
    const activeWork = works[motionController.getSnapshot().currentIndex];
    root.querySelector('[data-player-number]').textContent = `MIX ${activeWork.number} / CLIP ${String(playerSourceIndex + 1).padStart(2, '0')} OF ${String(playerSources.length).padStart(2, '0')}`;
    playerVideo.load();
    if (play) {
      playerVideo.play().catch(() => {
        // Native controls remain available if autoplay is blocked.
      });
    }
    return true;
  };

  const onPlayerEnded = () => {
    if (detailState !== DETAIL_STATES.playing || playerSources.length <= 1) return;
    loadPlayerSource(playerSourceIndex + 1);
  };

  const closeInfo = () => {
    if (detailState !== DETAIL_STATES.info) return false;
    infoPanel.setAttribute('aria-hidden', 'true');
    motionController.resume('info');
    setDetailState(DETAIL_STATES.idle);
    syncRendererPlayback();
    return true;
  };

  const openInfo = () => {
    const snapshot = motionController.getSnapshot();
    if (detailState !== DETAIL_STATES.idle || !snapshot.isSettled) return false;
    player.setAttribute('aria-hidden', 'true');
    infoPanel.setAttribute('aria-hidden', 'false');
    motionController.pause('info');
    setDetailState(DETAIL_STATES.info);
    syncRendererPlayback();
    return true;
  };

  const closePlayer = () => {
    if (detailState !== DETAIL_STATES.playing) return false;
    clearVideo(playerVideo);
    playerSources = [];
    playerSourceIndex = 0;
    playerVideo.hidden = false;
    playerMissing.hidden = true;
    player.setAttribute('aria-hidden', 'true');
    motionController.resume('playing');
    setDetailState(DETAIL_STATES.idle);
    syncRendererPlayback();
    return true;
  };

  const openPlayer = () => {
    const snapshot = motionController.getSnapshot();
    if (detailState !== DETAIL_STATES.idle || !snapshot.isSettled) return false;
    const work = works[snapshot.currentIndex];
    const media = resolveWorkMedia(work);
    infoPanel.setAttribute('aria-hidden', 'true');
    player.setAttribute('aria-hidden', 'false');
    root.querySelector('[data-player-asset]').textContent = assetLabel(media.status) || 'FINAL MEDIA';
    motionController.pause('playing');
    setDetailState(DETAIL_STATES.playing);
    syncRendererPlayback();

    if (media.type === 'video' && media.src) {
      playerMissing.hidden = true;
      playerVideo.hidden = false;
      playerSources = media.sources?.length ? [...media.sources] : [media.src];
      const rendererIndex = Number(renderer.getStats?.().current?.sourceIndex || 0);
      if (media.poster) playerVideo.poster = media.poster;
      else playerVideo.removeAttribute('poster');
      loadPlayerSource(rendererIndex);
    } else {
      clearVideo(playerVideo);
      playerSources = [];
      playerVideo.hidden = true;
      playerMissing.hidden = false;
    }
    return true;
  };

  const handleEscape = () => {
    if (detailState === DETAIL_STATES.playing) return closePlayer();
    if (detailState === DETAIL_STATES.info) return closeInfo();
    if (detailState === DETAIL_STATES.switching) {
      motionController.snapToNearest();
      return true;
    }
    if (detailState === DETAIL_STATES.idle) {
      onBack?.();
      return true;
    }
    return false;
  };

  const handleBack = () => {
    handleEscape();
  };

  const requestStep = (direction, source = 'button') => {
    if (detailState !== DETAIL_STATES.idle) return false;
    return motionController.step(direction, { source });
  };

  const onPrevClick = () => requestStep(-1, 'button');
  const onNextClick = () => requestStep(1, 'button');

  const onWheel = (event) => {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    if ([DETAIL_STATES.intro, DETAIL_STATES.info, DETAIL_STATES.playing].includes(detailState)) return;
    const delta = getWheelPixels(event, experience.clientHeight || window.innerHeight);
    const snapshot = motionController.getSnapshot();
    if (snapshot.isPaused && snapshot.pauseReason === 'media') {
      pendingMediaImpulse = clamp(
        pendingMediaImpulse + delta,
        -motionConfig.maxVelocity / motionConfig.impulseGain,
        motionConfig.maxVelocity / motionConfig.impulseGain,
      );
      return;
    }
    motionController.impulse(delta, { source: 'wheel', time: performance.now() });
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleEscape();
      return;
    }
    if (detailState !== DETAIL_STATES.idle) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key)) {
      event.preventDefault();
      requestStep(1, 'key');
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      requestStep(-1, 'key');
    } else if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      openInfo();
    } else if (event.key === ' ') {
      event.preventDefault();
      openPlayer();
    }
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      motionController.pause('hidden');
      syncRendererPlayback();
      return;
    }
    motionController.resume('hidden');
    syncRendererPlayback();
  };

  backButton.addEventListener('click', handleBack);
  menuButton.addEventListener('click', handleBack);
  prevButton.addEventListener('click', onPrevClick);
  nextButton.addEventListener('click', onNextClick);
  playButton.addEventListener('click', openPlayer);
  playButton.addEventListener('pointerenter', onPlayPointerEnter);
  playButton.addEventListener('pointermove', onPlayPointerMove);
  playButton.addEventListener('pointerleave', onPlayPointerLeave);
  playButton.addEventListener('focus', onPlayFocus);
  playButton.addEventListener('blur', onPlayBlur);
  playButton.addEventListener('animationend', onPlayInkAnimationEnd);
  playInk.addEventListener('transitionend', onPlayInkTransitionEnd);
  infoButton.addEventListener('click', openInfo);
  infoClose.addEventListener('click', closeInfo);
  playerClose.addEventListener('click', closePlayer);
  playerVideo.addEventListener('ended', onPlayerEnded);
  soundButton.addEventListener('click', toggleSound);
  experience.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibilityChange);

  requestAnimationFrame(() => experience.classList.add('is-ready'));
  introTimer = window.setTimeout(() => {
    introTimer = 0;
    if (!destroyed && detailState === DETAIL_STATES.intro) {
      setDetailState(DETAIL_STATES.idle);
      syncMotionDataset(motionController.getSnapshot());
    }
  }, reducedMotion ? 20 : 720);
  initialPairReady.finally(() => syncRendererDataset());

  return {
    getState: () => detailState,
    getActiveWorkId: () => works[motionController.getSnapshot().dominantIndex]?.id,
    navigateToWork(nextWorkId, { fromHash = true } = {}) {
      if (destroyed) return false;
      const targetIndex = works.findIndex((work) => work.id === nextWorkId);
      if (targetIndex < 0) return false;

      window.clearTimeout(introTimer);
      introTimer = 0;
      if (detailState === DETAIL_STATES.info) closeInfo();
      if (detailState === DETAIL_STATES.playing) closePlayer();
      if (detailState === DETAIL_STATES.intro) setDetailState(DETAIL_STATES.idle);
      pendingMediaImpulse = 0;

      const changed = motionController.goTo(targetIndex, {
        source: fromHash ? 'hash' : 'programmatic',
        direct: true,
      });
      if (!changed) {
        renderWork(targetIndex);
        syncAudioTrack(targetIndex);
        requestRendererPair(motionController.getSnapshot());
      }
      return changed;
    },
    updateProject(nextProject) {
      if (destroyed) return;
      const currentSnapshot = motionController.getSnapshot();
      const activeId = works[currentSnapshot.dominantIndex]?.id;
      if (detailState === DETAIL_STATES.info) closeInfo();
      if (detailState === DETAIL_STATES.playing) closePlayer();
      activeProject = sanitizeProject(nextProject);
      works = activeProject.works;
      syncInkConfig();
      const nextIndex = Math.max(0, works.findIndex((work) => work.id === activeId));
      const nextMotionConfig = createMotionConfig(activeProject);
      const recreateMotionController = [
        'stepVelocity',
        'directVelocity',
        'springStrength',
        'springDamping',
      ].some((key) => nextMotionConfig[key] !== motionConfig[key]);
      pairKey = '';
      pendingMediaImpulse = 0;
      transitionToken += 1;
      motionConfig = nextMotionConfig;
      if (recreateMotionController) {
        motionController.destroy();
        motionController = createMotionControllerForIndex(nextIndex);
        lastMotionSnapshot = motionController.getSnapshot();
      } else {
        motionController.updateCount(works.length, { activeIndex: nextIndex });
      }
      renderer.updateMotion(activeProject.motion);
      renderWork(nextIndex);
      syncAudioTrack(nextIndex);
      requestRendererPair(motionController.getSnapshot());
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      transitionToken += 1;
      pendingMediaImpulse = 0;
      window.clearTimeout(introTimer);
      window.clearTimeout(inkDelayTimer);
      window.clearTimeout(inkResetTimer);
      cancelAnimationFrame(inkPointerFrame);
      backButton.removeEventListener('click', handleBack);
      menuButton.removeEventListener('click', handleBack);
      prevButton.removeEventListener('click', onPrevClick);
      nextButton.removeEventListener('click', onNextClick);
      playButton.removeEventListener('click', openPlayer);
      playButton.removeEventListener('pointerenter', onPlayPointerEnter);
      playButton.removeEventListener('pointermove', onPlayPointerMove);
      playButton.removeEventListener('pointerleave', onPlayPointerLeave);
      playButton.removeEventListener('focus', onPlayFocus);
      playButton.removeEventListener('blur', onPlayBlur);
      playButton.removeEventListener('animationend', onPlayInkAnimationEnd);
      playInk.removeEventListener('transitionend', onPlayInkTransitionEnd);
      infoButton.removeEventListener('click', openInfo);
      infoClose.removeEventListener('click', closeInfo);
      playerClose.removeEventListener('click', closePlayer);
      playerVideo.removeEventListener('ended', onPlayerEnded);
      soundButton.removeEventListener('click', toggleSound);
      experience.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribeSound();
      clearVideo(playerVideo);
      motionController.destroy();
      renderer.destroy();
      if (window.__FLOWFRAME_DETAIL_DEBUG__ === debugApi) {
        delete window.__FLOWFRAME_DETAIL_DEBUG__;
      }
      root.replaceChildren();
    },
  };
}

export default mountWorkDetail;
