// Playback starts immediately where allowed, or inside the first scene gesture.
export function initMusic(canvas) {
  const button = document.querySelector('#music-toggle');
  const audio = new Audio('https://sakura-spring-station.decent-bear-2585.chatgpt.site/audio/spring-station.m4a');
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.38;

  const events = new AbortController();
  const options = { signal: events.signal };
  let userPaused = false;
  let pending = false;

  function showPlaying(playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    const label = playing ? '暂停音乐' : '播放音乐';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function play() {
    if (pending || !audio.paused) return;
    pending = true;
    audio.play().catch(() => {
      // An autoplay rejection is expected; retain the gesture fallback.
      showPlaying(false);
    }).finally(() => { pending = false; });
  }

  audio.addEventListener('playing', () => showPlaying(true), options);
  audio.addEventListener('pause', () => showPlaying(false), options);
  audio.addEventListener('waiting', () => showPlaying(false), options);
  audio.addEventListener('error', () => {
    showPlaying(false);
    button.title = '音乐暂时无法播放，点击重试';
    button.setAttribute('aria-label', button.title);
  }, options);

  button.addEventListener('click', () => {
    if (!audio.paused || pending) {
      userPaused = true;
      audio.pause();
      showPlaying(false);
    } else {
      userPaused = false;
      if (audio.error) audio.load();
      play();
    }
  }, options);

  const startFromScene = () => {
    if (!userPaused) play();
  };
  // The release events also cover browsers that unlock media on touch release.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
    canvas.addEventListener(type, startFromScene, { ...options, passive: true });
  }
  play();

  if (import.meta.hot) import.meta.hot.dispose(() => {
    events.abort();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  });
}

