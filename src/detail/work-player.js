export const playerMarkup = `
  <section class="work-player" role="dialog" aria-modal="true" aria-label="完整视频播放" aria-hidden="true" tabindex="-1" inert data-detail-player>
    <video class="work-player__video" playsinline preload="metadata" data-detail-player-video></video>
    <button class="work-play work-player__back" type="button" data-ink-phase="idle" data-detail-player-close aria-label="返回作品详情">
      <span class="work-play__ink" aria-hidden="true"></span>
      <span class="work-play__label">BACK</span><i aria-hidden="true"></i>
    </button>
    <div class="work-player__controls" data-player-controls>
      <button type="button" data-player-toggle aria-label="暂停">Ⅱ</button>
      <input type="range" min="0" max="100" step="0.05" value="0" aria-label="播放进度" data-player-progress>
      <label class="work-player__volume"><span aria-hidden="true">VOL</span>
        <input type="range" min="0" max="1" step="0.01" value="1" aria-label="音量" data-player-volume>
      </label>
    </div>
    <div class="work-player__missing" role="status" data-player-message hidden></div>
  </section>
  <div class="work-player-wipe" aria-hidden="true" hidden><div class="work-player-wipe__disc"></div></div>
`;

export function createWorkPlayer({ root, playButton, reducedMotion, audioController, onEnter, onLeave }) {
  const player = root.querySelector('[data-detail-player]');
  const video = root.querySelector('[data-detail-player-video]');
  const back = root.querySelector('[data-detail-player-close]');
  const toggle = root.querySelector('[data-player-toggle]');
  const progress = root.querySelector('[data-player-progress]');
  const volume = root.querySelector('[data-player-volume]');
  const message = root.querySelector('[data-player-message]');
  const wipe = root.querySelector('.work-player-wipe');
  const disc = root.querySelector('.work-player-wipe__disc');
  const controlRoot = document.querySelector('#flowframeControlRoot');
  let controlWasInert = false;
  // Reuse PLAY's ink filter and motion variables for the matching BACK button.
  back.querySelector('.work-play__ink').style.filter = `url(#${playButton.querySelector('filter').id})`;
  back.style.cssText = playButton.style.cssText;
  const events = new AbortController();
  let state = 'closed';
  let revision = 0;
  let hideTimer;
  let animation;
  let readyCleanup = () => {};
  const listen = (el, type, handler) => el.addEventListener(type, handler, { signal: events.signal });
  const showControls = () => {
    player.dataset.controls = 'visible';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!video.paused && !player.querySelector('.work-player__controls :focus-visible')) {
        player.dataset.controls = 'hidden';
      }
    }, 2200);
  };
  const showMessage = (text) => {
    message.textContent = text;
    message.hidden = !text;
  };
  const syncPlayback = () => {
    toggle.textContent = video.paused ? '▶' : 'Ⅱ';
    toggle.setAttribute('aria-label', video.paused ? '播放' : '暂停');
    if (video.paused && state === 'open') showControls();
  };
  const tryPlay = () => video.play().catch(() => {
    if (state === 'open') showControls();
  });
  const togglePlayback = () => {
    if (state !== 'open' || !video.getAttribute('src')) return;
    if (video.paused) tryPlay(); else video.pause();
    showControls();
  };
  const animate = async (frames, duration) => {
    const current = disc.animate(frames, { duration: reducedMotion ? 1 : duration, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' });
    animation = current;
    try {
      await current.finished;
      Object.assign(disc.style, frames.at(-1));
    } catch { /* Closing or destroying cancels the active wipe. */ }
    current.cancel();
  };
  const cover = async (button) => {
    const token = revision;
    const box = button.getBoundingClientRect();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    // Reach every corner even when the source button is near an edge.
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
    const size = Math.max(box.width, 1);
    Object.assign(disc.style, { width: `${size}px`, height: `${size}px`, left: `${x}px`, top: `${y}px` });
    wipe.hidden = false;
    wipe.dataset.phase = 'covering';
    await animate([{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(-50%, -50%) scale(${radius * 2 / size})`, opacity: 1 }], 620);
    if (token === revision) wipe.dataset.phase = 'covered';
  };
  const reveal = async () => {
    const token = revision;
    wipe.dataset.phase = 'revealing';
    await animate([{ opacity: 1 }, { opacity: 0 }], 340);
    if (token !== revision) return;
    wipe.hidden = true;
    animation?.cancel();
  };
  const clear = () => {
    readyCleanup();
    clearTimeout(hideTimer);
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.load();
    showMessage('');
    player.inert = true;
    player.setAttribute('aria-hidden', 'true');
    audioController?.resume?.('full-video');
  };
  const restoreChrome = () => {
    if (controlRoot) controlRoot.inert = controlWasInert;
    delete document.body.dataset.fullVideo;
  };
  const close = async ({ immediate = false } = {}) => {
    if (state === 'closed' || (state === 'closing' && !immediate)) return false;
    if (state === 'opening' && !immediate) return false;
    const token = ++revision;
    state = 'closing';
    if (immediate) {
      animation?.cancel();
      wipe.hidden = true;
    } else await cover(back);
    if (token !== revision) return false;
    clear();
    onLeave();
    if (!immediate) {
      await reveal();
      if (token !== revision) return false;
      playButton.dataset.playerReturnFocus = 'true';
      playButton.focus({ preventScroll: true });
      delete playButton.dataset.playerReturnFocus;
    }
    restoreChrome();
    state = 'closed';
    return true;
  };
  const open = async (media) => {
    if (state !== 'closed') return false;
    state = 'opening';
    const token = ++revision;
    controlWasInert = controlRoot?.inert || false;
    if (controlRoot) controlRoot.inert = true;
    document.body.dataset.fullVideo = 'true';
    player.dataset.controls = 'hidden';
    progress.value = '0';
    progress.disabled = true;
    toggle.disabled = !media?.src;
    volume.disabled = !media?.src;
    showMessage('');
    audioController?.suspend?.('full-video');
    let ready = Promise.resolve();
    let holdFirstFrame = true;
    if (media?.src) {
      ready = new Promise((resolve) => {
        const finish = () => { readyCleanup(); resolve(); };
        const timer = setTimeout(finish, 4500);
        readyCleanup = () => {
          clearTimeout(timer);
          video.removeEventListener('loadeddata', finish);
          video.removeEventListener('error', finish);
          resolve();
        };
        video.addEventListener('loadeddata', finish, { once: true });
        video.addEventListener('error', finish, { once: true });
      });
      video.src = media.src;
      video.loop = false;
      // Unlock within the click gesture, then hold the first frame while the
      // circle expands so the viewer does not miss the opening of the video.
      video.load();
      video.play().then(() => {
        if (token === revision && holdFirstFrame) {
          video.pause();
          video.currentTime = 0;
        }
      }).catch(() => {});
    }
    await cover(playButton);
    if (token !== revision) return false;
    player.inert = false;
    player.setAttribute('aria-hidden', 'false');
    onEnter();
    await ready;
    if (token !== revision) return false;
    holdFirstFrame = false;
    if (!media?.src) showMessage('完整视频尚未提供。请返回作品详情。');
    else if (video.error) showMessage('视频加载失败。请返回后重试。');
    else if (video.readyState < 2) showMessage('视频加载中…');
    if (media?.src && !video.error) tryPlay();
    await reveal();
    if (token !== revision) return false;
    state = 'open';
    player.focus({ preventScroll: true });
    if (video.paused) showControls();
    return true;
  };
  listen(back, 'click', () => close());
  listen(back, 'pointerenter', () => { back.dataset.inkPhase = 'expanded'; });
  listen(back, 'pointerleave', () => { back.dataset.inkPhase = 'idle'; });
  listen(back, 'focus', () => { back.dataset.inkPhase = 'expanded'; });
  listen(back, 'blur', () => { back.dataset.inkPhase = 'idle'; });
  listen(player, 'pointermove', showControls);
  listen(player, 'pointerdown', showControls);
  listen(player, 'focusin', (event) => { if (event.target !== player) showControls(); });
  listen(toggle, 'click', togglePlayback);
  listen(video, 'click', togglePlayback);
  listen(video, 'play', syncPlayback);
  listen(video, 'pause', syncPlayback);
  listen(video, 'ended', showControls);
  listen(video, 'loadeddata', () => { showMessage(''); });
  listen(video, 'playing', () => { showMessage(''); });
  listen(video, 'error', () => { if (video.getAttribute('src')) { showMessage('视频加载失败。请返回后重试。'); showControls(); } });
  listen(video, 'durationchange', () => { progress.disabled = !Number.isFinite(video.duration) || video.duration <= 0; });
  listen(video, 'timeupdate', () => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      progress.value = String(video.currentTime / video.duration * 100);
      progress.setAttribute('aria-valuetext', `${Math.floor(video.currentTime)} / ${Math.floor(video.duration)} 秒`);
    }
  });
  listen(progress, 'input', () => {
    if (Number.isFinite(video.duration)) video.currentTime = Number(progress.value) / 100 * video.duration;
    showControls();
  });
  listen(volume, 'input', () => { video.volume = Number(volume.value); video.muted = video.volume === 0; showControls(); });
  listen(player, 'keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === ' ' && !event.target.matches('input, button')) { event.preventDefault(); event.stopPropagation(); togglePlayback(); }
    else if (event.key === 'Tab') {
      showControls();
      const controls = [...player.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === player)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  return { open, close, isActive: () => state !== 'closed', destroy() {
    revision++;
    events.abort();
    animation?.cancel();
    clear();
    restoreChrome();
    state = 'closed';
  } };
}
