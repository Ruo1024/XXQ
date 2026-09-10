const DEFAULT_TRACK = Object.freeze({
  id: 'afterglow',
  src: '/media/audio/cigarette-and-her-bgm.m4a',
});

const listeners = new Set();
let audioElement = null;
let activeTrack = { ...DEFAULT_TRACK };
let requestedOn = true;
let trackError = false;
let trackRevision = 0;
let playbackAttempt = null;
let playbackAttemptRevision = -1;

const getState = () => {
  if (!activeTrack.src) return 'missing';
  if (trackError) return 'error';
  if (!requestedOn) return 'off';
  if (!audioElement || audioElement.paused) return 'armed';
  return 'playing';
};

const getTrack = () => ({ ...activeTrack });

const notify = () => {
  const state = getState();
  document.body.dataset.bgmState = state;
  document.body.dataset.bgmTrack = activeTrack.id;
  listeners.forEach((listener) => listener(state, getTrack()));
};

const syncElementTrack = (audio) => {
  audio.pause();
  audio.removeAttribute('src');
  audio.dataset.flowframeBgmTrack = activeTrack.id;
  audio.dataset.flowframeBgmSrc = activeTrack.src;
  if (activeTrack.src) audio.src = activeTrack.src;
  audio.load();
};

const ensureAudio = () => {
  if (audioElement) return audioElement;
  audioElement = document.createElement('audio');
  audioElement.loop = true;
  audioElement.preload = 'metadata';
  audioElement.volume = 0.28;
  audioElement.dataset.flowframeBgm = '';
  audioElement.setAttribute('aria-hidden', 'true');
  audioElement.addEventListener('play', notify);
  audioElement.addEventListener('pause', notify);
  audioElement.addEventListener('ended', notify);
  audioElement.addEventListener('error', () => {
    if (audioElement?.dataset.flowframeBgmSrc !== activeTrack.src) return;
    trackError = true;
    notify();
  });
  syncElementTrack(audioElement);
  document.body.append(audioElement);
  return audioElement;
};

const playRequestedTrack = async (revision = trackRevision) => {
  if (!requestedOn || !activeTrack.src) return getState();
  if (playbackAttempt && playbackAttemptRevision === revision) return playbackAttempt;
  const audio = ensureAudio();
  const attempt = (async () => {
    try {
      await audio.play();
    } catch {
      if (revision === trackRevision) audio.pause();
    }
    notify();
    return getState();
  })().finally(() => {
    if (playbackAttempt === attempt) {
      playbackAttempt = null;
      playbackAttemptRevision = -1;
    }
  });
  playbackAttempt = attempt;
  playbackAttemptRevision = revision;
  return playbackAttempt;
};

const setEnabled = async (enabled) => {
  const audio = ensureAudio();
  requestedOn = Boolean(enabled);

  if (!requestedOn || !activeTrack.src) {
    audio.pause();
    notify();
    return getState();
  }

  return playRequestedTrack(trackRevision);
};

const setTrack = async (source, { id = '' } = {}) => {
  const nextTrack = {
    id: String(id || 'unassigned'),
    src: String(source || ''),
  };
  if (nextTrack.id === activeTrack.id && nextTrack.src === activeTrack.src) {
    if (requestedOn && activeTrack.src) return playRequestedTrack(trackRevision);
    return getState();
  }

  activeTrack = nextTrack;
  trackError = false;
  const revision = ++trackRevision;
  const audio = ensureAudio();
  syncElementTrack(audio);
  notify();

  if (requestedOn && activeTrack.src) return playRequestedTrack(revision);
  return getState();
};

document.addEventListener('visibilitychange', () => {
  if (!audioElement || !requestedOn || !activeTrack.src) return;
  if (document.hidden) {
    audioElement.pause();
    return;
  }
  playRequestedTrack(trackRevision);
});

const unlockRequestedAudio = () => {
  if (!requestedOn || !activeTrack.src || (audioElement && !audioElement.paused)) return;
  playRequestedTrack(trackRevision);
};

document.addEventListener('pointerdown', unlockRequestedAudio, { capture: true, passive: true });
document.addEventListener('touchstart', unlockRequestedAudio, { capture: true, passive: true });
document.addEventListener('wheel', unlockRequestedAudio, { capture: true, passive: true });
document.addEventListener('keydown', unlockRequestedAudio, { capture: true });

export const backgroundAudio = Object.freeze({
  getState,
  getTrack,
  isRequestedOn: () => requestedOn,
  getElement: ensureAudio,
  setEnabled,
  setTrack,
  toggle: () => setEnabled(!requestedOn),
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener(getState(), getTrack());
    return () => listeners.delete(listener);
  },
});

export default backgroundAudio;
