import {
  DEFAULT_MOTION,
  PROJECT_STORAGE_KEY,
  createDefaultProject,
  sanitizeProject,
} from './project-contract.js';

const VERSION_THREE_MOTION = Object.freeze({
  homePointerX: 0.52,
  homePointerY: 0.34,
  homeDamping: 0.065,
  homeCameraTravel: 1,
  transitionDuration: 1.45,
  transitionDistortion: 0.62,
  transitionScale: 1.12,
  transitionBlur: 9,
  transitionMaskAngle: -14,
  transitionTextDelay: 0.18,
});

const VERSION_FOUR_MOTION = Object.freeze({
  homePointerX: 0.7,
  homePointerY: 0.46,
  homeDamping: 0.072,
  homeCameraTravel: 1.18,
  transitionDuration: 1.1,
  transitionDistortion: 0.92,
  transitionScale: 1.2,
  transitionBlur: 14,
  transitionMaskAngle: -22,
  transitionTextDelay: 0.12,
});

const getStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const VERSION_TWO_SIGNATURES = Object.freeze({
  afterglow: {
    titleEn: 'CIGARETTE & HER',
    description: '城市、烟雾与猫族少女的短促情绪，被整理为一段节奏明确的角色影像。',
    posters: ['/media/works/cigarette-and-her/home-poster.webp'],
    videos: ['/media/works/cigarette-and-her/segments/segment-01.mp4'],
  },
  tide: {
    titleEn: 'TIDAL SIGNAL',
    description: '海风、停顿和眼神被剪成一段低频的蓝色回声。',
    posters: ['/media/stills/ai/glass-tide.webp', '/media/posters/tide-placeholder.webp'],
    videos: ['/media/placeholders/afterglow-02.mp4'],
  },
  ember: {
    titleEn: 'DARKFIRE ARCHIVE',
    description: '暗红颗粒和短促残影组成一份人物动作档案。',
    posters: ['/media/stills/ai/night-transit.webp', '/media/posters/ember-placeholder.webp'],
    videos: ['/media/placeholders/afterglow-03.mp4'],
  },
  glass: {
    titleEn: 'GLASS MONSOON',
    description: '玻璃折射、高光边缘和干净切点组成轻未来感。',
    posters: ['/media/stills/ai/glass-monsoon.webp', '/media/posters/glass-placeholder.webp'],
    videos: ['/media/placeholders/afterglow-01.mp4'],
  },
  signal: {
    titleEn: 'SPECTRUM PLAZA',
    description: '舞台、街区和节拍被整理成明亮而克制的频谱。',
    posters: ['/media/stills/ai/spectrum-plaza.webp', '/media/posters/signal-placeholder.webp'],
    videos: ['/media/placeholders/afterglow-02.mp4'],
  },
});

const matchesLegacyDefault = (work, signature) => {
  if (!work || !signature) return false;
  const posterValues = [work.poster, work.coverImage, work.posterSrc].filter(Boolean);
  const firstClipSource = Array.isArray(work.clips) ? work.clips.find((clip) => clip?.src)?.src : '';
  const videoValues = [work.videoSrc, firstClipSource].filter(Boolean);
  const posterMatches = posterValues.some((value) => signature.posters.includes(String(value)));
  const videoMatches = videoValues.some((value) => signature.videos.includes(String(value)));
  return String(work.titleEn || '') === signature.titleEn
    && String(work.description || work.shortDescription || '') === signature.description
    && (posterMatches || videoMatches);
};

const matchesLegacyOrbit = (work) => {
  if (work?.id !== 'orbit' || String(work.titleEn || '') !== 'ORBITAL CUTS') return false;
  const poster = String(work.poster || work.coverImage || work.posterSrc || '');
  const firstClip = Array.isArray(work.clips) ? work.clips.find((clip) => clip?.src)?.src : '';
  return ['/media/stills/ai/orbital-cuts.webp', '/media/posters/orbit-placeholder.webp'].includes(poster)
    || firstClip === '/media/placeholders/afterglow-01.mp4';
};

const migrateDefaultMotion = (motion) => {
  const nextMotion = { ...(motion || {}) };
  Object.entries(VERSION_THREE_MOTION).forEach(([key, oldValue]) => {
    if (Number(nextMotion[key]) === oldValue) nextMotion[key] = DEFAULT_MOTION[key];
  });
  return nextMotion;
};

const migrateVersionFourMotion = (motion) => {
  const nextMotion = { ...(motion || {}) };
  Object.entries(VERSION_FOUR_MOTION).forEach(([key, oldValue]) => {
    if (Number(nextMotion[key]) === oldValue) nextMotion[key] = DEFAULT_MOTION[key];
  });
  return nextMotion;
};

export const migrateProject = (input) => {
  if (!input || typeof input !== 'object') return input;
  const defaultProject = createDefaultProject();
  let version = Number(input.version || 1);
  let works = Array.isArray(input.works) ? [...input.works] : [];

  if (version < 2) {
    const legacyIndex = works.findIndex((work) => work?.id === 'afterglow');
    if (legacyIndex >= 0) works[legacyIndex] = defaultProject.works[0];
    version = 2;
  }

  if (version < 3) {
    const defaultsById = new Map(defaultProject.works.map((work) => [work.id, work]));
    works = works.map((work) => {
      const signature = VERSION_TWO_SIGNATURES[work?.id];
      if (!matchesLegacyDefault(work, signature)) return work;
      return defaultsById.get(work.id) || work;
    });
    version = 3;
  }

  let motion = input.motion;
  if (version < 4) {
    works = works.filter((work) => !matchesLegacyOrbit(work));
    motion = migrateDefaultMotion(input.motion);
    version = 4;
  }

  if (version < 5) {
    motion = migrateVersionFourMotion(motion);
    version = 5;
  }

  return {
    ...input,
    version,
    motion,
    works: works.length ? works : defaultProject.works,
  };
};

export const loadProject = () => {
  const storage = getStorage();
  if (!storage) return sanitizeProject(createDefaultProject());

  try {
    const stored = storage.getItem(PROJECT_STORAGE_KEY);
    return stored ? sanitizeProject(migrateProject(JSON.parse(stored))) : sanitizeProject(createDefaultProject());
  } catch (error) {
    console.warn('FLOWFRAME：本地配置读取失败，已改用默认配置。', error);
    return sanitizeProject(createDefaultProject());
  }
};

export const saveProject = (project) => {
  const safeProject = sanitizeProject(project);
  const storage = getStorage();
  if (!storage) return safeProject;

  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(safeProject));
  return safeProject;
};

export const resetProject = () => {
  const storage = getStorage();
  storage?.removeItem(PROJECT_STORAGE_KEY);
  return sanitizeProject(createDefaultProject());
};

export const downloadProject = (project) => {
  const safeProject = sanitizeProject(project);
  const json = `${JSON.stringify(safeProject, null, 2)}\n`;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `flowframe-project-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return safeProject;
};

export const parseImportedProject = (text) => {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch {
    throw new Error('这个文件不是有效的 JSON 配置。');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('配置内容必须是一个项目对象。');
  }

  if (!Array.isArray(parsed.works)) {
    throw new Error('配置中缺少 works 作品列表。');
  }

  return sanitizeProject(migrateProject(parsed));
};
