import * as THREE from 'three';

const DEFAULT_ACCENT = '#28343b';
const DEFAULT_MAX_DPR = 1.6;
const MEDIA_TIMEOUT_MS = 9000;
const ENDPOINT_EPSILON = 0.00001;

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const finiteOr = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const createAbortError = () => {
  try {
    return new DOMException('Media preparation was cancelled.', 'AbortError');
  } catch {
    const error = new Error('Media preparation was cancelled.');
    error.name = 'AbortError';
    return error;
  }
};

const parseFocalPoint = (value = '50% 50%') => {
  if (Array.isArray(value)) {
    const normalize = (entry) => {
      const numeric = Number.parseFloat(entry);
      if (!Number.isFinite(numeric)) return 0.5;
      return clamp(String(entry).includes('%') || numeric > 1 ? numeric / 100 : numeric, 0, 1);
    };
    return {
      x: normalize(value[0] ?? 0.5),
      y: normalize(value[1] ?? 0.5),
    };
  }

  if (value && typeof value === 'object') {
    const normalize = (entry) => {
      const numeric = Number(entry);
      return clamp(numeric > 1 ? numeric / 100 : numeric, 0, 1);
    };
    return {
      x: normalize(value.x ?? 0.5),
      y: normalize(value.y ?? 0.5),
    };
  }

  const [rawX = '50%', rawY = '50%'] = String(value).trim().split(/\s+/);
  const normalize = (entry) => {
    const numeric = Number.parseFloat(entry);
    if (!Number.isFinite(numeric)) return 0.5;
    return clamp(String(entry).includes('%') || numeric > 1 ? numeric / 100 : numeric, 0, 1);
  };

  return { x: normalize(rawX), y: normalize(rawY) };
};

const focalPointToCss = (value) => {
  const focal = parseFocalPoint(value);
  return `${(focal.x * 100).toFixed(2)}% ${(focal.y * 100).toFixed(2)}%`;
};

const computeCoverUv = (mediaWidth, mediaHeight, viewportWidth, viewportHeight, focalPoint) => {
  const width = Math.max(1, Number(mediaWidth) || 1);
  const height = Math.max(1, Number(mediaHeight) || 1);
  const targetWidth = Math.max(1, Number(viewportWidth) || 1);
  const targetHeight = Math.max(1, Number(viewportHeight) || 1);
  const mediaAspect = width / height;
  const viewportAspect = targetWidth / targetHeight;
  const focal = parseFocalPoint(focalPoint);
  let scaleX = 1;
  let scaleY = 1;

  if (mediaAspect > viewportAspect) scaleX = viewportAspect / mediaAspect;
  else scaleY = mediaAspect / viewportAspect;

  return {
    scaleX,
    scaleY,
    offsetX: (1 - scaleX) * focal.x,
    // Product data uses CSS coordinates, while WebGL UV y grows from bottom to top.
    offsetY: (1 - scaleY) * (1 - focal.y),
  };
};

const normalizeDescriptor = (descriptor = {}) => {
  const media = descriptor?.media && typeof descriptor.media === 'object'
    ? descriptor.media
    : {};
  const declaredSources = Array.isArray(media.sources)
    ? media.sources.map((source) => String(source || '')).filter(Boolean)
    : [];
  const src = String(media.src || declaredSources[0] || '');
  const poster = String(
    media.poster
    || media.posterSrc
    || descriptor.posterSrc
    || descriptor.coverImage
    || '',
  );
  let type = String(media.type || '').toLowerCase();

  if (!['video', 'image', 'fallback'].includes(type)) {
    if (src && /\.(mp4|m4v|webm|mov)(?:$|[?#])/i.test(src)) type = 'video';
    else if (src) type = 'image';
    else type = 'fallback';
  }

  return {
    id: String(descriptor?.id || ''),
    media: {
      type,
      src,
      sources: type === 'video' ? [...new Set([src, ...declaredSources].filter(Boolean))] : [],
      poster,
      status: String(media.status || 'missing'),
    },
    focalPoint: descriptor?.focalPoint || '50% 50%',
    accent: String(descriptor?.accent || DEFAULT_ACCENT),
  };
};

const descriptorKey = (descriptor) => [
  descriptor.id,
  descriptor.media.type,
  descriptor.media.src,
  descriptor.media.sources.join(','),
  descriptor.media.poster,
  descriptor.accent,
].join('|');

const parseAccentBytes = (value) => {
  const source = String(value || '').trim();
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(source);
  const full = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(source);
  if (short) {
    return short.slice(1).map((entry) => Number.parseInt(`${entry}${entry}`, 16));
  }
  if (full) return full.slice(1).map((entry) => Number.parseInt(entry, 16));
  return [40, 52, 59];
};

const configureTexture = (texture) => {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const createFallbackResource = (accent = DEFAULT_ACCENT) => {
  const [red, green, blue] = parseAccentBytes(accent);
  const texture = new THREE.DataTexture(
    new Uint8Array([red, green, blue, 255]),
    1,
    1,
    THREE.RGBAFormat,
  );
  configureTexture(texture);
  return {
    kind: 'fallback',
    texture,
    width: 1,
    height: 1,
    image: null,
    video: null,
    source: '',
    playBlocked: false,
  };
};

const isCrossOrigin = (source, ownerWindow) => {
  if (!source || !ownerWindow?.location) return false;
  try {
    const url = new URL(source, ownerWindow.location.href);
    return ['http:', 'https:'].includes(url.protocol) && url.origin !== ownerWindow.location.origin;
  } catch {
    return false;
  }
};

const disposeVideoElement = (video) => {
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.removeAttribute('poster');
  video.load();
};

const disposeResource = (resource) => {
  if (!resource) return;
  resource.cleanup?.();
  resource.texture?.dispose?.();
  disposeVideoElement(resource.video);
  if (resource.image) {
    resource.image.onload = null;
    resource.image.onerror = null;
    resource.image.removeAttribute?.('src');
  }
};

const loadImageResource = (source, { ownerWindow, signal } = {}) => new Promise((resolve, reject) => {
  if (!source) {
    reject(new Error('Image source is empty.'));
    return;
  }

  const ImageConstructor = ownerWindow?.Image || globalThis.Image;
  if (!ImageConstructor) {
    reject(new Error('Image loading is not available.'));
    return;
  }

  const image = new ImageConstructor();
  let settled = false;
  let timer = 0;

  const cleanup = () => {
    if (timer) ownerWindow.clearTimeout(timer);
    image.onload = null;
    image.onerror = null;
    signal?.removeEventListener('abort', onAbort);
  };

  const fail = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    image.removeAttribute?.('src');
    reject(error);
  };

  const onAbort = () => fail(createAbortError());

  image.onload = async () => {
    if (settled) return;
    try {
      await image.decode?.();
    } catch {
      // A completed image remains usable when decode() is not implemented or rejects.
    }
    if (signal?.aborted) {
      fail(createAbortError());
      return;
    }
    settled = true;
    cleanup();
    const texture = configureTexture(new THREE.Texture(image));
    resolve({
      kind: 'image',
      texture,
      width: Math.max(1, image.naturalWidth || image.width || 1),
      height: Math.max(1, image.naturalHeight || image.height || 1),
      image,
      video: null,
      source,
      playBlocked: false,
    });
  };
  image.onerror = () => fail(new Error(`Unable to load image: ${source}`));
  signal?.addEventListener('abort', onAbort, { once: true });

  if (signal?.aborted) {
    onAbort();
    return;
  }
  if (isCrossOrigin(source, ownerWindow)) image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = source;
  timer = ownerWindow.setTimeout(
    () => fail(new Error(`Image loading timed out: ${source}`)),
    MEDIA_TIMEOUT_MS,
  );
});

const loadVideoResource = (sourceInput, poster, { ownerDocument, ownerWindow, signal } = {}) => new Promise((resolve, reject) => {
  const sources = [...new Set(
    (Array.isArray(sourceInput) ? sourceInput : [sourceInput])
      .map((source) => String(source || ''))
      .filter(Boolean),
  )];
  if (!sources.length) {
    reject(new Error('Video source is empty.'));
    return;
  }

  const video = ownerDocument.createElement('video');
  let settled = false;
  let timer = 0;
  let resource = null;
  let sourceIndex = 0;
  let consecutiveFailures = 0;

  video.muted = true;
  video.loop = sources.length === 1;
  video.autoplay = false;
  video.playsInline = true;
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  video.setAttribute('aria-hidden', 'true');

  const cleanup = () => {
    if (timer) ownerWindow.clearTimeout(timer);
    video.removeEventListener('loadeddata', onReady);
    video.removeEventListener('canplay', onReady);
    video.removeEventListener('error', onError);
    signal?.removeEventListener('abort', onAbort);
  };

  const fail = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    disposeVideoElement(video);
    reject(error);
  };

  const playIfRequested = () => {
    if (!resource?.shouldPlay) return;
    resource.playBlocked = false;
    const playPromise = video.play();
    playPromise?.catch?.(() => {
      if (resource) resource.playBlocked = true;
    });
  };

  const loadPlaylistSource = (nextIndex, { play = false } = {}) => {
    sourceIndex = ((nextIndex % sources.length) + sources.length) % sources.length;
    const source = sources[sourceIndex];
    if (isCrossOrigin(source, ownerWindow)) video.crossOrigin = 'anonymous';
    video.src = source;
    if (resource) {
      resource.source = source;
      resource.sourceIndex = sourceIndex;
    }
    video.load();
    if (play) playIfRequested();
  };

  const onPlaylistReady = () => {
    if (!resource) return;
    resource.width = Math.max(1, video.videoWidth || resource.width || 1);
    resource.height = Math.max(1, video.videoHeight || resource.height || 1);
    consecutiveFailures = 0;
    playIfRequested();
  };

  const advancePlaylist = () => {
    if (!resource || sources.length <= 1) return;
    loadPlaylistSource(sourceIndex + 1, { play: true });
  };

  const onPlaylistError = () => {
    if (!resource || sources.length <= 1 || consecutiveFailures >= sources.length - 1) {
      if (resource) resource.playBlocked = true;
      return;
    }
    consecutiveFailures += 1;
    advancePlaylist();
  };

  const onReady = () => {
    if (settled || video.readyState < 2) return;
    if (signal?.aborted) {
      fail(createAbortError());
      return;
    }
    settled = true;
    cleanup();
    const texture = configureTexture(new THREE.VideoTexture(video));
    resource = {
      kind: 'video',
      texture,
      width: Math.max(1, video.videoWidth || 1),
      height: Math.max(1, video.videoHeight || 1),
      image: null,
      video,
      source: sources[0],
      sources: [...sources],
      sourceIndex: 0,
      shouldPlay: false,
      playBlocked: false,
      cleanup: () => {
        video.removeEventListener('ended', advancePlaylist);
        video.removeEventListener('loadeddata', onPlaylistReady);
        video.removeEventListener('error', onPlaylistError);
      },
    };
    video.addEventListener('ended', advancePlaylist);
    video.addEventListener('loadeddata', onPlaylistReady);
    video.addEventListener('error', onPlaylistError);
    resolve(resource);
  };
  const onError = () => fail(new Error(`Unable to load video: ${sources[0]}`));
  const onAbort = () => fail(createAbortError());

  video.addEventListener('loadeddata', onReady);
  video.addEventListener('canplay', onReady);
  video.addEventListener('error', onError);
  signal?.addEventListener('abort', onAbort, { once: true });

  if (signal?.aborted) {
    onAbort();
    return;
  }
  if (isCrossOrigin(sources[0], ownerWindow)) video.crossOrigin = 'anonymous';
  if (poster) video.poster = poster;
  video.src = sources[0];
  video.load();
  timer = ownerWindow.setTimeout(
    () => fail(new Error(`Video loading timed out: ${sources[0]}`)),
    MEDIA_TIMEOUT_MS,
  );
});

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec2 vUv;

  uniform sampler2D uCurrent;
  uniform sampler2D uIncoming;
  uniform vec2 uViewportPx;
  uniform vec2 uScaleCurrent;
  uniform vec2 uOffsetCurrent;
  uniform vec2 uScaleIncoming;
  uniform vec2 uOffsetIncoming;
  uniform float uProgress;
  uniform float uDirection;
  uniform float uVelocity;
  uniform float uTime;
  uniform float uReducedMotion;
  uniform float uWaveStrength;
  uniform float uWaveFrequency;
  uniform float uRowDelay;
  uniform float uDepthShift;

  const float PI = 3.141592653589793;

  vec2 mirrorRepeat(vec2 value) {
    vec2 folded = mod(value, 2.0);
    folded = mix(folded, 2.0 - folded, step(1.0, folded));
    return clamp(folded, vec2(0.0005), vec2(0.9995));
  }

  vec2 coverUv(vec2 uv, vec2 scale, vec2 offset) {
    return uv * scale + offset;
  }

  vec4 readCurrent(vec2 uv) {
    return texture2D(uCurrent, mirrorRepeat(coverUv(uv, uScaleCurrent, uOffsetCurrent)));
  }

  vec4 readIncoming(vec2 uv) {
    return texture2D(uIncoming, mirrorRepeat(coverUv(uv, uScaleIncoming, uOffsetIncoming)));
  }

  void main() {
    vec2 viewport = max(uViewportPx, vec2(1.0));
    vec2 screenUv = gl_FragCoord.xy / viewport;

    if (uProgress <= ${ENDPOINT_EPSILON.toFixed(5)}) {
      gl_FragColor = readCurrent(vUv);
      #include <colorspace_fragment>
      return;
    }
    if (uProgress >= ${(1 - ENDPOINT_EPSILON).toFixed(5)}) {
      gl_FragColor = readIncoming(vUv);
      #include <colorspace_fragment>
      return;
    }

    float direction = uDirection < 0.0 ? -1.0 : 1.0;
    float velocityGain = clamp(abs(uVelocity) * 0.35, 0.0, 1.0);
    float rowDelay = mix(0.24, 0.40, velocityGain)
      * uRowDelay
      * (1.0 - uReducedMotion);
    float rowAxis = direction > 0.0 ? screenUv.y : 1.0 - screenUv.y;
    float localProgress = clamp(
      uProgress * (1.0 + rowDelay) - rowAxis * rowDelay,
      0.0,
      1.0
    );
    localProgress = localProgress * localProgress * (3.0 - 2.0 * localProgress);

    float globalPulse = sin(PI * uProgress);
    float localPulse = sin(PI * localProgress);
    float waveStrength = (0.010 + velocityGain * 0.012)
      * uWaveStrength
      * globalPulse
      * (0.35 + localPulse * 0.65)
      * (1.0 - uReducedMotion);
    vec2 wave = vec2(
      sin(screenUv.y * 19.0 * uWaveFrequency + uTime * 1.7),
      cos((screenUv.x * 11.0 + screenUv.y * 4.0) * uWaveFrequency + uTime * 1.15)
    ) * waveStrength;

    float travel = (0.055 + velocityGain * 0.025) * (1.0 - uReducedMotion);
    vec2 currentMotion = vec2(-direction * travel * localProgress, -0.008 * globalPulse);
    vec2 incomingMotion = vec2(direction * travel * (1.0 - localProgress), 0.008 * globalPulse);
    float depthPulse = globalPulse * uDepthShift * (1.0 - uReducedMotion);
    vec2 currentDepthUv = (vUv - 0.5) * (1.0 + depthPulse * 0.055) + 0.5;
    vec2 incomingDepthUv = (vUv - 0.5) * (1.0 - depthPulse * 0.042) + 0.5;
    vec2 currentUv = currentDepthUv + currentMotion + wave;
    vec2 incomingUv = incomingDepthUv + incomingMotion - wave * 0.82;

    vec4 currentColor = readCurrent(currentUv);
    vec4 incomingColor = readIncoming(incomingUv);
    float blend = smoothstep(0.0, 1.0, localProgress);
    gl_FragColor = mix(currentColor, incomingColor, blend);
    #include <colorspace_fragment>
  }
`;

const createStaticFallback = (host) => {
  const ownerDocument = host.ownerDocument;
  const fallback = ownerDocument.createElement('div');
  const image = ownerDocument.createElement('img');
  const label = ownerDocument.createElement('span');

  fallback.dataset.detailRenderFallback = 'true';
  fallback.setAttribute('aria-hidden', 'true');
  Object.assign(fallback.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    display: 'none',
    placeItems: 'center',
    background: DEFAULT_ACCENT,
    color: '#fff',
  });
  Object.assign(image.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'none',
    objectFit: 'cover',
  });
  image.alt = '';
  image.draggable = false;
  Object.assign(label.style, {
    position: 'absolute',
    left: '24px',
    bottom: '22px',
    zIndex: '1',
    padding: '7px 9px',
    background: 'rgba(0, 0, 0, 0.58)',
    color: '#fff',
    font: '600 9px/1.2 system-ui, sans-serif',
    letterSpacing: '0.16em',
  });
  label.textContent = 'STATIC MEDIA FALLBACK';
  fallback.append(image, label);
  host.append(fallback);

  let descriptor = normalizeDescriptor();

  const update = (nextDescriptor) => {
    descriptor = normalizeDescriptor(nextDescriptor);
    const { media } = descriptor;
    const stillSource = media.type === 'image' ? media.src : media.poster;
    fallback.style.background = descriptor.accent || DEFAULT_ACCENT;
    image.style.objectPosition = focalPointToCss(descriptor.focalPoint);
    if (stillSource) {
      image.src = stillSource;
      image.style.display = 'block';
      label.textContent = media.status === 'missing'
        ? 'MEDIA MISSING / STATIC FALLBACK'
        : 'STATIC MEDIA FALLBACK';
    } else {
      image.removeAttribute('src');
      image.style.display = 'none';
      label.textContent = 'MEDIA MISSING / STATIC FALLBACK';
    }
  };

  return {
    element: fallback,
    show(nextDescriptor = descriptor) {
      update(nextDescriptor);
      fallback.style.display = 'grid';
    },
    hide() {
      fallback.style.display = 'none';
    },
    update,
    destroy() {
      image.removeAttribute('src');
      fallback.remove();
    },
  };
};

export function createDetailWebGLRenderer({
  host,
  maxDpr = DEFAULT_MAX_DPR,
  reducedMotion = false,
  motion = {},
  onContextStateChange,
} = {}) {
  if (!host || typeof host.append !== 'function' || !host.ownerDocument) {
    throw new TypeError('createDetailWebGLRenderer requires a valid host element.');
  }

  const ownerDocument = host.ownerDocument;
  const ownerWindow = ownerDocument.defaultView || globalThis.window;
  const staticFallback = createStaticFallback(host);
  const dprLimit = clamp(maxDpr || DEFAULT_MAX_DPR, 1, 2);
  const prefersReducedMotion = Boolean(reducedMotion);
  let renderer = null;
  let scene = null;
  let camera = null;
  let geometry = null;
  let material = null;
  let mesh = null;
  let resizeObserver = null;
  let animationFrame = 0;
  let destroyed = false;
  let paused = false;
  let contextLost = false;
  let fallbackMode = false;
  let fallbackReason = '';
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let progress = 0;
  let direction = 1;
  let velocity = 0;
  let timeOverride = null;
  let pairSerial = 0;
  let pairToken = null;
  let effectConfig = {
    transitionWaveStrength: clamp(finiteOr(motion?.transitionWaveStrength, 1), 0, 2.4),
    transitionWaveFrequency: clamp(finiteOr(motion?.transitionWaveFrequency, 1), 0.35, 3),
    transitionRowDelay: clamp(finiteOr(motion?.transitionRowDelay, 1), 0, 2.5),
    transitionDepthShift: clamp(finiteOr(motion?.transitionDepthShift, 1), 0, 2.5),
  };
  let currentDescriptor = normalizeDescriptor();
  let nextDescriptor = normalizeDescriptor();
  const drawingBufferSize = new THREE.Vector2(1, 1);

  const notifyContext = (state, details = {}) => {
    if (typeof onContextStateChange !== 'function') return;
    try {
      onContextStateChange({ state, fallback: fallbackMode || contextLost, ...details });
    } catch {
      // A consumer callback must not break renderer cleanup or recovery.
    }
  };

  const createSlot = (name) => {
    let descriptor = normalizeDescriptor();
    let key = descriptorKey(descriptor);
    let resource = createFallbackResource(descriptor.accent);
    let generation = 0;
    let pendingController = null;

    const getStats = () => ({
      name,
      id: descriptor.id,
      kind: resource.kind,
      source: resource.source,
      sources: resource.sources || [],
      sourceIndex: Number(resource.sourceIndex || 0),
      playlistLength: resource.sources?.length || (resource.kind === 'video' ? 1 : 0),
      status: descriptor.media.status,
      ready: Boolean(resource.texture),
      width: resource.width,
      height: resource.height,
      playing: Boolean(resource.video && !resource.video.paused),
      currentTime: Number(resource.video?.currentTime || 0),
      playBlocked: Boolean(resource.playBlocked),
    });

    const prepare = async (rawDescriptor, isRequestCurrent) => {
      const normalized = normalizeDescriptor(rawDescriptor);
      const nextKey = descriptorKey(normalized);
      if (nextKey === key) {
        descriptor = normalized;
        return { stale: false, reused: true, stats: getStats() };
      }

      const requestGeneration = ++generation;
      pendingController?.abort();
      const controller = new AbortController();
      pendingController = controller;
      let candidate = null;

      const requestIsCurrent = () => (
        !destroyed
        && generation === requestGeneration
        && !controller.signal.aborted
        && isRequestCurrent()
      );

      try {
        if (normalized.media.type === 'video' && normalized.media.src) {
          try {
            candidate = await loadVideoResource(
              normalized.media.sources.length ? normalized.media.sources : normalized.media.src,
              normalized.media.poster,
              { ownerDocument, ownerWindow, signal: controller.signal },
            );
          } catch (error) {
            if (error?.name === 'AbortError' || !requestIsCurrent()) throw error;
            if (normalized.media.poster) {
              candidate = await loadImageResource(normalized.media.poster, {
                ownerWindow,
                signal: controller.signal,
              });
              candidate.kind = 'poster';
            }
          }
        } else {
          const imageSource = normalized.media.src || normalized.media.poster;
          if (imageSource) {
            candidate = await loadImageResource(imageSource, {
              ownerWindow,
              signal: controller.signal,
            });
          }
        }
      } catch (error) {
        if (error?.name === 'AbortError' || !requestIsCurrent()) {
          disposeResource(candidate);
          return { stale: true, reused: false, stats: getStats() };
        }
      }

      if (!requestIsCurrent()) {
        disposeResource(candidate);
        return { stale: true, reused: false, stats: getStats() };
      }

      if (!candidate) candidate = createFallbackResource(normalized.accent);
      const previousResource = resource;
      resource = candidate;
      descriptor = normalized;
      key = nextKey;
      pendingController = null;
      disposeResource(previousResource);
      return { stale: false, reused: false, stats: getStats() };
    };

    return {
      prepare,
      get descriptor() {
        return descriptor;
      },
      get texture() {
        return resource.texture;
      },
      get width() {
        return resource.width;
      },
      get height() {
        return resource.height;
      },
      get isVideo() {
        return resource.kind === 'video';
      },
      get video() {
        return resource.video;
      },
      getStats,
      markTextureForUpload() {
        if (resource.texture) resource.texture.needsUpdate = true;
      },
      setPlaying(shouldPlay) {
        const video = resource.video;
        if (!video) return;
        resource.shouldPlay = Boolean(shouldPlay);
        if (!shouldPlay) {
          video.pause();
          return;
        }
        if (!video.paused) return;
        resource.playBlocked = false;
        const playPromise = video.play();
        if (playPromise?.catch) {
          playPromise.catch(() => {
            resource.playBlocked = true;
          });
        }
      },
      release() {
        generation += 1;
        pendingController?.abort();
        pendingController = null;
        disposeResource(resource);
        resource = null;
      },
    };
  };

  const currentSlot = createSlot('current');
  const nextSlot = createSlot('next');

  const getVisibleFallbackDescriptor = () => (progress >= 0.5 ? nextDescriptor : currentDescriptor);

  const useFallback = (reason) => {
    fallbackMode = true;
    fallbackReason = String(reason?.message || reason || 'WebGL is unavailable.');
    staticFallback.show(getVisibleFallbackDescriptor());
    notifyContext('fallback', { reason: fallbackReason });
  };

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x20272c, 1);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.dataset.detailWebgl = 'true';
    Object.assign(renderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
    });
    host.append(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.Camera();
    geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
    const uniforms = {
      uCurrent: { value: currentSlot.texture },
      uIncoming: { value: nextSlot.texture },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uScaleCurrent: { value: new THREE.Vector2(1, 1) },
      uOffsetCurrent: { value: new THREE.Vector2(0, 0) },
      uScaleIncoming: { value: new THREE.Vector2(1, 1) },
      uOffsetIncoming: { value: new THREE.Vector2(0, 0) },
      uProgress: { value: 0 },
      uDirection: { value: 1 },
      uVelocity: { value: 0 },
      uTime: { value: 0 },
      uReducedMotion: { value: prefersReducedMotion ? 1 : 0 },
      uWaveStrength: { value: effectConfig.transitionWaveStrength },
      uWaveFrequency: { value: effectConfig.transitionWaveFrequency },
      uRowDelay: { value: effectConfig.transitionRowDelay },
      uDepthShift: { value: effectConfig.transitionDepthShift },
    };
    material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    staticFallback.hide();
  } catch (error) {
    renderer?.dispose?.();
    renderer?.domElement?.remove?.();
    renderer = null;
    useFallback(error);
  }

  const updateCoverUniforms = () => {
    if (!material) return;
    const currentUv = computeCoverUv(
      currentSlot.width,
      currentSlot.height,
      width,
      height,
      currentSlot.descriptor.focalPoint,
    );
    const incomingUv = computeCoverUv(
      nextSlot.width,
      nextSlot.height,
      width,
      height,
      nextSlot.descriptor.focalPoint,
    );
    material.uniforms.uScaleCurrent.value.set(currentUv.scaleX, currentUv.scaleY);
    material.uniforms.uOffsetCurrent.value.set(currentUv.offsetX, currentUv.offsetY);
    material.uniforms.uScaleIncoming.value.set(incomingUv.scaleX, incomingUv.scaleY);
    material.uniforms.uOffsetIncoming.value.set(incomingUv.offsetX, incomingUv.offsetY);
  };

  const updateTextureUniforms = () => {
    if (!material) return;
    material.uniforms.uCurrent.value = currentSlot.texture;
    material.uniforms.uIncoming.value = nextSlot.texture;
    updateCoverUniforms();
  };

  const getNowSeconds = (frameTime) => {
    if (Number.isFinite(timeOverride)) return timeOverride;
    if (Number.isFinite(frameTime)) return frameTime / 1000;
    return (ownerWindow?.performance?.now?.() || Date.now()) / 1000;
  };

  const renderOnce = (frameTime) => {
    if (!renderer || !material || destroyed || contextLost) return;
    material.uniforms.uTime.value = getNowSeconds(frameTime);
    renderer.render(scene, camera);
  };

  const needsContinuousFrames = () => {
    if (destroyed || paused || contextLost || fallbackMode) return false;
    if (progress > ENDPOINT_EPSILON && progress < 1 - ENDPOINT_EPSILON) return true;
    if (progress <= ENDPOINT_EPSILON) return Boolean(currentSlot.video && !currentSlot.video.paused);
    return Boolean(nextSlot.video && !nextSlot.video.paused);
  };

  const stopLoop = () => {
    if (!animationFrame) return;
    ownerWindow.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  const frame = (frameTime) => {
    animationFrame = 0;
    renderOnce(frameTime);
    if (needsContinuousFrames()) animationFrame = ownerWindow.requestAnimationFrame(frame);
  };

  const ensureLoop = () => {
    if (animationFrame || !needsContinuousFrames()) return;
    animationFrame = ownerWindow.requestAnimationFrame(frame);
  };

  const syncVideoPlayback = () => {
    if (paused || contextLost || fallbackMode) {
      currentSlot.setPlaying(false);
      nextSlot.setPlaying(false);
      stopLoop();
      return;
    }

    currentSlot.setPlaying(progress < 1 - ENDPOINT_EPSILON);
    nextSlot.setPlaying(progress > ENDPOINT_EPSILON);
    ensureLoop();
  };

  const resize = () => {
    if (destroyed) return;
    const bounds = host.getBoundingClientRect?.();
    width = Math.max(1, Math.round(host.clientWidth || bounds?.width || 1));
    height = Math.max(1, Math.round(host.clientHeight || bounds?.height || 1));
    pixelRatio = Math.min(dprLimit, Math.max(1, ownerWindow?.devicePixelRatio || 1));

    if (!renderer || fallbackMode) {
      staticFallback.update(getVisibleFallbackDescriptor());
      return;
    }

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(drawingBufferSize);
    material.uniforms.uViewportPx.value.copy(drawingBufferSize);
    updateCoverUniforms();
    renderOnce();
  };

  const onContextLost = (event) => {
    event.preventDefault();
    if (destroyed) return;
    contextLost = true;
    stopLoop();
    currentSlot.setPlaying(false);
    nextSlot.setPlaying(false);
    staticFallback.show(getVisibleFallbackDescriptor());
    notifyContext('lost');
  };

  const onContextRestored = () => {
    if (destroyed) return;
    contextLost = false;
    currentSlot.markTextureForUpload();
    nextSlot.markTextureForUpload();
    staticFallback.hide();
    resize();
    syncVideoPlayback();
    notifyContext('restored');
  };

  if (renderer) {
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);
    if (typeof ownerWindow.ResizeObserver === 'function') {
      resizeObserver = new ownerWindow.ResizeObserver(resize);
      resizeObserver.observe(host);
    }
    ownerWindow.addEventListener('resize', resize, { passive: true });
    resize();
    notifyContext('ready', { fallback: false });
  } else {
    resize();
  }

  const setPair = async (rawCurrentDescriptor, rawNextDescriptor, { token = null } = {}) => {
    if (destroyed) return { stale: true, token, mode: fallbackMode ? 'fallback' : 'webgl' };
    const requestSerial = ++pairSerial;
    pairToken = token;
    const requestedCurrent = normalizeDescriptor(rawCurrentDescriptor);
    const requestedNext = normalizeDescriptor(rawNextDescriptor || rawCurrentDescriptor);
    const requestIsCurrent = () => !destroyed && requestSerial === pairSerial && pairToken === token;

    if (fallbackMode) {
      currentDescriptor = requestedCurrent;
      nextDescriptor = requestedNext;
      staticFallback.update(getVisibleFallbackDescriptor());
      const fallbackImage = staticFallback.element.querySelector('img');
      try {
        await fallbackImage?.decode?.();
      } catch {
        // A static accent fallback remains readable if the image cannot decode.
      }
      return {
        stale: !requestIsCurrent(),
        token,
        mode: 'fallback',
        current: currentDescriptor.id,
        next: nextDescriptor.id,
      };
    }

    const [currentResult, nextResult] = await Promise.all([
      currentSlot.prepare(requestedCurrent, requestIsCurrent),
      nextSlot.prepare(requestedNext, requestIsCurrent),
    ]);

    if (!requestIsCurrent() || currentResult.stale || nextResult.stale) {
      return { stale: true, token, mode: 'webgl' };
    }

    currentDescriptor = requestedCurrent;
    nextDescriptor = requestedNext;
    updateTextureUniforms();
    syncVideoPlayback();
    renderOnce();
    return {
      stale: false,
      token,
      mode: 'webgl',
      current: currentSlot.getStats(),
      next: nextSlot.getStats(),
    };
  };

  const setProgress = (nextProgress, {
    direction: nextDirection = direction,
    velocity: nextVelocity = 0,
    time,
  } = {}) => {
    if (destroyed) return;
    progress = clamp(nextProgress, 0, 1);
    direction = Number(nextDirection) < 0 ? -1 : 1;
    velocity = clamp(Math.abs(nextVelocity), 0, 4);
    const numericTime = Number(time);
    timeOverride = time === null || time === undefined || !Number.isFinite(numericTime)
      ? null
      : numericTime;

    if (fallbackMode || contextLost) {
      staticFallback.update(getVisibleFallbackDescriptor());
      return;
    }

    material.uniforms.uProgress.value = progress;
    material.uniforms.uDirection.value = direction;
    material.uniforms.uVelocity.value = velocity;
    if (timeOverride !== null) material.uniforms.uTime.value = timeOverride;
    syncVideoPlayback();
    renderOnce();
    ensureLoop();
  };

  const setPaused = (nextPaused) => {
    if (destroyed) return;
    paused = Boolean(nextPaused);
    syncVideoPlayback();
    if (!paused) renderOnce();
  };

  const updateMotion = (nextMotion = {}) => {
    if (destroyed) return;
    effectConfig = {
      transitionWaveStrength: clamp(finiteOr(nextMotion.transitionWaveStrength, 1), 0, 2.4),
      transitionWaveFrequency: clamp(finiteOr(nextMotion.transitionWaveFrequency, 1), 0.35, 3),
      transitionRowDelay: clamp(finiteOr(nextMotion.transitionRowDelay, 1), 0, 2.5),
      transitionDepthShift: clamp(finiteOr(nextMotion.transitionDepthShift, 1), 0, 2.5),
    };
    if (!material) return;
    material.uniforms.uWaveStrength.value = effectConfig.transitionWaveStrength;
    material.uniforms.uWaveFrequency.value = effectConfig.transitionWaveFrequency;
    material.uniforms.uRowDelay.value = effectConfig.transitionRowDelay;
    material.uniforms.uDepthShift.value = effectConfig.transitionDepthShift;
    renderOnce();
  };

  const getStats = () => ({
    mode: fallbackMode ? 'fallback' : 'webgl',
    fallback: fallbackMode || contextLost,
    fallbackReason,
    destroyed,
    paused,
    contextLost,
    reducedMotion: prefersReducedMotion,
    pairToken,
    progress,
    direction,
    velocity,
    motion: { ...effectConfig },
    viewport: {
      width,
      height,
      dpr: pixelRatio,
      drawingBufferWidth: renderer ? drawingBufferSize.x : 0,
      drawingBufferHeight: renderer ? drawingBufferSize.y : 0,
    },
    current: currentSlot.getStats(),
    next: nextSlot.getStats(),
  });

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    pairSerial += 1;
    stopLoop();
    resizeObserver?.disconnect();
    ownerWindow.removeEventListener('resize', resize);
    if (renderer) {
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored, false);
    }
    currentSlot.release();
    nextSlot.release();
    scene?.remove(mesh);
    geometry?.dispose();
    material?.dispose();
    renderer?.dispose();
    renderer?.domElement?.remove();
    staticFallback.destroy();
    renderer = null;
    scene = null;
    camera = null;
    geometry = null;
    material = null;
    mesh = null;
  };

  return {
    setPair,
    setProgress,
    setPaused,
    updateMotion,
    resize,
    getStats,
    destroy,
  };
}

export default createDetailWebGLRenderer;
