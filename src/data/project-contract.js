import { DEFAULT_MOTION, sanitizeMotion } from './motion-schema.js';

export { DEFAULT_MOTION } from './motion-schema.js';

export const PROJECT_STORAGE_KEY = 'flowframe-project-v1';

export const PROJECT_LIMITS = Object.freeze({
  minWorks: 1,
  maxWorks: 6,
  desktopMinWidth: 1180,
});

export const ASSET_STATUS = Object.freeze({
  final: 'final',
  placeholder: 'placeholder',
  missing: 'missing',
});

const makeClip = (id, title, src, tone, note = '程序生成的动效测试片段，只用于验证转场，不是最终视频。') => ({
  id,
  title,
  src,
  poster: '',
  tone,
  status: ASSET_STATUS.placeholder,
  note,
});

const BASE_WORKS = [
  {
    id: 'afterglow',
    order: 1,
    index: '01',
    title: '尼古喵喵',
    titleEn: 'YANI NEKO',
    category: 'MAD / CHARACTER EDIT',
    year: '2026',
    description: '城市、烟雾与猫族少女的短促情绪，被整理为一段节奏明确的角色影像。',
    accent: '#90aa9b',
    poster: '/media/works/cigarette-and-her/home-poster.webp',
    detailStill: '/media/works/cigarette-and-her/detail-poster.jpg',
    audioSrc: '/media/audio/cigarette-and-her-bgm.m4a',
    audioStatus: ASSET_STATUS.placeholder,
    mediaNote: '《ヤニねこ》官方主视觉与用户指定 MAD 测试片段；授权尚未完成核验。',
    posterFocalPoint: '50% 48%',
    mediaFocalPoint: '50% 50%',
    posterStatus: ASSET_STATUS.placeholder,
    clips: [
      makeClip('cigarette-her-01', 'STREET', '/media/works/cigarette-and-her/segments/segment-01.mp4', '#7f986f', '用户提供视频的 28.4–34.4 秒裁切片段；已移除黑边、字幕区和平台标记，仅用于效果测试。'),
      makeClip('cigarette-her-02', 'GARDEN', '/media/works/cigarette-and-her/segments/segment-02.mp4', '#a6b579', '用户提供视频的 68.3–74.3 秒裁切片段；已移除黑边、字幕区和平台标记，仅用于效果测试。'),
      makeClip('cigarette-her-03', 'NIGHT', '/media/works/cigarette-and-her/segments/segment-03.mp4', '#2b6b83', '用户提供视频的 158.9–165.9 秒裁切片段；已移除黑边、字幕区和平台标记，仅用于效果测试。'),
    ],
  },
  {
    id: 'tide',
    order: 2,
    index: '02',
    title: 'EVA',
    titleEn: 'EVANGELION',
    category: 'MAD / SCI-FI MEMORY',
    year: '2021',
    description: '夕阳、海面与旧日片段在强烈的光线变化中交叠，形成一段关于告别的记忆。',
    accent: '#559bc1',
    poster: '/media/works/eva/home-poster.webp',
    detailStill: '/media/works/eva/detail-poster.webp',
    audioSrc: '/media/audio/eva-bgm.m4a',
    audioStatus: ASSET_STATUS.placeholder,
    mediaNote: '官方 EVA 海报与用户指定 Bilibili MAD 派生测试媒体；右上水印按用户要求保留。',
    posterFocalPoint: '50% 62%',
    mediaFocalPoint: '50% 50%',
    posterStatus: ASSET_STATUS.placeholder,
    clips: [
      makeClip('eva-01', 'SUNSET', '/media/works/eva/segments/segment-01.mp4', '#e5a74b', '用户指定原片 83–89 秒；保留原始 16:9 构图和右上水印，缩放为 1920×1080，无音轨，仅用于本地效果测试。'),
      makeClip('eva-02', 'IMPACT', '/media/works/eva/segments/segment-02.mp4', '#d94e3d', '用户指定原片 159–165 秒；保留原始 16:9 构图和右上水印，缩放为 1920×1080，无音轨，仅用于本地效果测试。'),
      makeClip('eva-03', 'MEMORY', '/media/works/eva/segments/segment-03.mp4', '#98768d', '用户指定原片 190–196 秒；保留原始 16:9 构图和右上水印，缩放为 1920×1080，无音轨，仅用于本地效果测试。'),
    ],
  },
  {
    id: 'ember',
    order: 3,
    index: '03',
    title: '超时空辉夜姬',
    titleEn: 'COSMIC PRINCESS KAGUYA',
    category: 'MAD / VIRTUAL IDOL',
    year: '2026',
    description: '房间、烟火与虚拟舞台把两位少女的距离拉进同一条明亮的时间线。',
    accent: '#de8d9d',
    poster: '/media/works/kaguya/home-poster.webp',
    detailStill: '/media/works/kaguya/detail-poster.webp',
    audioSrc: '/media/audio/kaguya-bgm.m4a',
    audioStatus: ASSET_STATUS.placeholder,
    mediaNote: '《超かぐや姫！》官方主视觉与用户指定 Bilibili MAD 派生测试媒体。',
    posterFocalPoint: '54% 54%',
    mediaFocalPoint: '50% 50%',
    posterStatus: ASSET_STATUS.placeholder,
    clips: [
      makeClip('kaguya-01', 'FIREWORKS', '/media/works/kaguya/segments/segment-01.mp4', '#d99b7a', '用户指定原片 60–66 秒；裁掉上下留白后输出 1920×764 宽银幕无声片段，仅用于本地效果测试。'),
      makeClip('kaguya-02', 'STAGE', '/media/works/kaguya/segments/segment-02.mp4', '#8070aa', '用户指定原片 100–106 秒；裁掉上下留白后输出 1920×764 宽银幕无声片段，仅用于本地效果测试。'),
      makeClip('kaguya-03', 'SHORE', '/media/works/kaguya/segments/segment-03.mp4', '#a86f86', '用户指定原片 180–186 秒；裁掉上下留白后输出 1920×764 宽银幕无声片段，仅用于本地效果测试。'),
    ],
  },
  {
    id: 'glass',
    order: 4,
    index: '04',
    title: '利兹与青鸟',
    titleEn: 'LIZ AND THE BLUE BIRD',
    category: 'MAD / COMING OF AGE',
    year: '2026',
    description: '乐谱、蓝鸟与迟疑的目光，在安静的教室里连接两位少女的选择。',
    accent: '#83bbc0',
    poster: '/media/works/liz-and-blue-bird/home-poster.webp',
    detailStill: '/media/works/liz-and-blue-bird/detail-poster.webp',
    audioSrc: '/media/audio/liz-and-blue-bird-bgm.m4a',
    audioStatus: ASSET_STATUS.placeholder,
    mediaNote: '《利兹与青鸟》官方主视觉与用户指定 Bilibili MAD 派生测试媒体。',
    posterFocalPoint: '50% 54%',
    mediaFocalPoint: '50% 50%',
    posterStatus: ASSET_STATUS.placeholder,
    clips: [
      makeClip('liz-01', 'CLASSROOM', '/media/works/liz-and-blue-bird/segments/segment-01.mp4', '#d6c69d', '用户指定原片 181–187 秒；裁掉上下留白后输出 1920×764 宽银幕无声片段，仅用于本地效果测试。'),
      makeClip('liz-02', 'GLANCE', '/media/works/liz-and-blue-bird/segments/segment-02.mp4', '#9fc8cd', '用户指定原片 23–29 秒；裁掉上下留白后输出 1920×764 宽银幕无声片段，仅用于本地效果测试。'),
      makeClip('liz-03', 'BLUE BIRD', '/media/works/liz-and-blue-bird/segments/segment-03.mp4', '#68aebd', '用户指定原片 121–127 秒；裁掉上下留白后输出 1920×764 宽银幕无声片段，仅用于本地效果测试。'),
    ],
  },
  {
    id: 'signal',
    order: 5,
    index: '05',
    title: 'Ave Mujica',
    titleEn: 'AVE MUJICA',
    category: 'MAD / DRAMATIC MEMORY',
    year: '2025',
    description: '钢琴、剧场与祥子的记忆在冷色雨夜中收紧，留下克制的舞台余响。',
    accent: '#915b9b',
    poster: '/media/works/ave-mujica/home-poster.webp',
    detailStill: '/media/works/ave-mujica/detail-poster.webp',
    audioSrc: '/media/audio/ave-mujica-bgm.m4a',
    audioStatus: ASSET_STATUS.placeholder,
    mediaNote: '《BanG Dream! Ave Mujica》官方主视觉与用户指定 Bilibili MAD 派生测试媒体。',
    posterFocalPoint: '50% 52%',
    mediaFocalPoint: '50% 50%',
    posterStatus: ASSET_STATUS.placeholder,
    clips: [
      makeClip('mujica-01', 'PIANO', '/media/works/ave-mujica/segments/segment-01.mp4', '#866b8f', '用户指定原片 4–10 秒；人工复核后裁掉上下留白与字幕区，输出 1920×800 宽银幕无声片段，仅用于本地效果测试。'),
      makeClip('mujica-02', 'CLASSROOM', '/media/works/ave-mujica/segments/segment-02.mp4', '#4f566f', '用户指定原片 28–34 秒；人工复核后裁掉上下留白与字幕区，输出 1920×800 宽银幕无声片段，仅用于本地效果测试。'),
      makeClip('mujica-03', 'BAND', '/media/works/ave-mujica/segments/segment-03.mp4', '#62556d', '用户指定原片 100–106 秒；人工复核后裁掉上下留白与字幕区，输出 1920×800 宽银幕无声片段，仅用于本地效果测试。'),
    ],
  },
];

const WORK_DETAIL_PROFILES = Object.freeze({
  afterglow: {
    infoDescription: '在人类与兽人共同生活的世界里，21 岁的ヤニねこ把烟、酒和懒散放在生活中心。房租、打工、妹妹和邻居不断把她卷进荒唐又松弛的日常。',
    infoSections: [
      { label: 'CHARACTER', body: '她的本名是佐藤ヤニ子。与不靠谱的姐姐相反，妹妹妹子认真可靠；看似严厉的房东则承担了这个混乱公寓里的常识人角色。' },
      { label: 'TONE', body: '作品用粗粝笑料包住生活感。角色很糟糕，却并不让人讨厌；城市、烟雾和猫族群像共同形成了松散而鲜活的气质。' },
    ],
    mixDirection: '用街道、绿色远景和夜海三个完整镜头测试切换。片段本身静音，由用户手动开启的全站 BGM 单独播放，避免双重音轨。',
    transitionMood: 'soft',
    frameNotes: [
      { timecode: '00:28', note: '街道镜头建立人物与环境。' },
      { timecode: '01:08', note: '绿色远景检查大范围运动稳定性。' },
      { timecode: '02:38', note: '夜海镜头用于低亮度转场收束。' },
    ],
  },
  tide: {
    infoDescription: '《新·福音战士剧场版》是新剧场版系列的终章。碇真嗣和伙伴们在几乎走到尽头的世界里，再次面对选择、关系与告别。',
    infoSections: [
      { label: 'CHARACTERS', body: '真嗣、明日香、绫波丽、葛城美里与渚薰等人的记忆彼此交叠。故事最终关心的不是兵器本身，而是人能否离开封闭的内心。' },
      { label: 'VISUAL NOTE', body: '夕阳海面、列车、红色冲击和手绘草图不断交替，让宏大终局与个人记忆保持在同一个情绪空间。' },
    ],
    mixDirection: '用夕阳、红色冲击和记忆叠化检查高亮与暗部之间的连续过渡。切片静音，独立 BGM 跟随当前作品切换。',
    transitionMood: 'wave',
    frameNotes: [
      { timecode: '01:23', note: '眼神叠化进入夕阳海面，作为默认详情背景。' },
      { timecode: '02:39', note: '红色冲击镜头用于检查高对比转场。' },
      { timecode: '03:10', note: '草图、列车和人物记忆形成连续叠化。' },
    ],
  },
  ember: {
    infoDescription: '《超时空辉夜姬》把古老的辉夜姬传说放进近未来。忙于学业和打工的酒寄彩叶遇见来自月亮的神秘少女，并陪她进入虚拟空间“月读”。',
    infoSections: [
      { label: 'RELATION', body: '彩叶负责创作音乐，辉夜作为主播歌唱。两个人在共同完成舞台的过程中逐渐靠近，却也必须面对辉夜终将被带回月亮的命运。' },
      { label: 'VISUAL NOTE', body: '现实房间、虚拟舞台、烟火和高速三维镜头交织在一起。音乐不是背景装饰，而是少女之间建立联系的方式。' },
    ],
    mixDirection: '用烟火、月下舞台和海边人物检查明亮色彩、低亮画面与人物近景之间的波浪接管。',
    transitionMood: 'sharp',
    frameNotes: [
      { timecode: '01:00', note: '人物近景转入烟火，色彩变化最清楚。' },
      { timecode: '01:40', note: '月下舞台与图形化灯光用于检查暗部。' },
      { timecode: '03:00', note: '海边人物近景作为柔和收束。' },
    ],
  },
  glass: {
    infoDescription: '《利兹与青鸟》聚焦北宇治高中吹奏乐部的铠塚霙与伞木希美。毕业临近，两个人在合奏曲《利兹与青鸟》中听见了彼此关系的距离。',
    infoSections: [
      { label: 'RELATION', body: '霙把希美视为无可替代的存在，希美却难以直接回应这种重量。长笛与双簧管的合奏，逐渐变成她们学习放手的另一种语言。' },
      { label: 'VISUAL NOTE', body: '脚步、呼吸、走廊反光和细小视线构成影片节奏。童话中的利兹与青鸟，也映照着现实中留下与离开的选择。' },
    ],
    mixDirection: '用教室双人构图、人物目光和蓝鸟叠化检查浅色画面的层次。运动保持安静，不加入强闪白。',
    transitionMood: 'clean',
    frameNotes: [
      { timecode: '03:01', note: '夕阳教室里的双人构图作为默认详情背景。' },
      { timecode: '00:23', note: '人物目光在高亮背景中保持可读。' },
      { timecode: '02:01', note: '蓝鸟叠化连接人物与乐器。' },
    ],
  },
  signal: {
    infoDescription: '丰川祥子召集成员组成蒙面乐队 Ave Mujica。舞台和媒体带来成功，但每个人隐藏的过去、真实身份与不同目的，也开始破坏这座精心搭建的箱庭。',
    infoSections: [
      { label: 'CHARACTERS', body: '祥子以键盘手 Oblivionis 的身份维持乐队世界观。初华、睦、海铃和若麦分别戴上新的名字与面具，却无法永远把旧关系留在舞台外。' },
      { label: 'VISUAL NOTE', body: '面具、幕布、钢琴、雨夜和冷色灯光让演出带有戏剧审判感。华丽舞台越完整，角色之间的不稳定就越明显。' },
    ],
    mixDirection: '用钢琴、冷色近景和雨夜乐队检查暖冷变化。保持戏剧感，但不加入额外舞台 HUD。',
    transitionMood: 'rhythmic',
    frameNotes: [
      { timecode: '00:04', note: '钢琴和手部运动作为默认详情背景。' },
      { timecode: '00:28', note: '冷色人物近景转入教室。' },
      { timecode: '01:40', note: '雨夜街道转入乐队排练空间。' },
    ],
  },
});

export const DEFAULT_WORKS = Object.freeze(BASE_WORKS.map((work, index) => {
  const profile = WORK_DETAIL_PROFILES[work.id];
  const primaryClip = work.clips[0];
  return Object.freeze({
    ...work,
    number: String(index + 1).padStart(3, '0'),
    meta: [work.category, work.year].filter(Boolean).join(' / '),
    shortDescription: work.description,
    infoDescription: profile.infoDescription,
    infoSections: profile.infoSections,
    frameNotes: profile.frameNotes,
    mixDirection: profile.mixDirection,
    accentColor: work.accent,
    transitionMood: profile.transitionMood,
    coverImage: work.poster,
    posterSrc: work.detailStill || work.poster,
    videoSrc: primaryClip?.src || '',
    audioSrc: String(work.audioSrc || ''),
    coverStatus: work.posterStatus,
    videoStatus: primaryClip?.status || ASSET_STATUS.missing,
    audioStatus: work.audioStatus || (work.audioSrc ? ASSET_STATUS.placeholder : ASSET_STATUS.missing),
    mediaNote: String(work.mediaNote || '未完成授权核验的测试媒体，仅用于本地视觉与交互验证。'),
    mediaFocalPoint: work.mediaFocalPoint || '58% 50%',
    copySide: 'left',
  });
}));

export const createDefaultProject = () => ({
  version: 5,
  title: 'FLOWFRAME',
  assetNotice: 'PLACEHOLDER MEDIA',
  motion: { ...DEFAULT_MOTION },
  works: DEFAULT_WORKS.map((work) => ({
    ...work,
    clips: work.clips.map((clip) => ({ ...clip })),
    frameNotes: work.frameNotes.map((note) => ({ ...note })),
    infoSections: work.infoSections.map((section) => ({ ...section })),
  })),
});

const normalizeAssetStatus = (value, fallback = ASSET_STATUS.missing) =>
  Object.values(ASSET_STATUS).includes(value) ? value : fallback;

const makeUniqueId = (value, index, usedIds) => {
  const requested = String(value || `work-${index + 1}`).trim() || `work-${index + 1}`;
  let candidate = requested;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${requested}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
};

const LEGACY_DEFAULT_POSTER = /^\/media\/posters\/(afterglow|tide|ember|glass|signal|orbit)-placeholder\.webp$/;

const migrateLegacyPoster = (value, fallbackValue) => {
  const normalized = String(value || '');
  return LEGACY_DEFAULT_POSTER.test(normalized) ? String(fallbackValue || '') : normalized;
};

export const resolveWorkMedia = (work) => {
  const clipSources = Array.isArray(work?.clips)
    ? work.clips.map((clip) => String(clip?.src || '')).filter(Boolean)
    : [];
  const videoSrc = String(work?.videoSrc || clipSources[0] || '');
  const sources = [...new Set([videoSrc, ...clipSources].filter(Boolean))];

  if (videoSrc) {
    return {
      type: 'video',
      src: videoSrc,
      sources,
      poster: String(work.posterSrc || work.coverImage || ''),
      status: normalizeAssetStatus(work.videoStatus),
    };
  }
  if (work?.posterSrc) {
    return {
      type: 'image',
      src: String(work.posterSrc),
      sources: [],
      poster: '',
      status: normalizeAssetStatus(work.posterStatus),
    };
  }
  if (work?.coverImage) {
    return {
      type: 'image',
      src: String(work.coverImage),
      sources: [],
      poster: '',
      status: normalizeAssetStatus(work.coverStatus),
    };
  }
  return { type: 'fallback', src: '', sources: [], poster: '', status: ASSET_STATUS.missing };
};

export const sanitizeProject = (input) => {
  const fallback = createDefaultProject();
  if (!input || typeof input !== 'object') return fallback;

  const sourceWorks = Array.isArray(input.works) ? input.works : fallback.works;
  const usedIds = new Set();
  const works = sourceWorks
    .slice(0, PROJECT_LIMITS.maxWorks)
    .filter((work) => work && typeof work === 'object')
    .map((work, index) => {
      const base = fallback.works[index % fallback.works.length];
      const clips = Array.isArray(work.clips)
        ? work.clips.filter(Boolean).map((clip, clipIndex) => ({
            id: String(clip.id || `clip-${index + 1}-${clipIndex + 1}`),
            title: String(clip.title || `CLIP ${clipIndex + 1}`),
            src: String(clip.src || ''),
            poster: String(clip.poster || ''),
            tone: String(clip.tone || '#b8b8b8'),
            status: normalizeAssetStatus(clip.status),
            note: String(clip.note || ''),
          }))
        : [];
      const primaryClip = clips.find((clip) => clip.src) || clips[0];
      const coverImage = migrateLegacyPoster(
        work.coverImage ?? work.poster ?? base.coverImage ?? base.poster ?? '',
        base.coverImage ?? base.poster,
      );
      const posterSrc = migrateLegacyPoster(
        work.posterSrc ?? work.poster ?? work.coverImage ?? base.posterSrc ?? coverImage,
        base.posterSrc ?? base.coverImage ?? base.poster,
      );
      const videoSrc = String(work.videoSrc ?? primaryClip?.src ?? '');
      const audioSrc = String(work.audioSrc ?? base.audioSrc ?? '');
      const posterStatus = normalizeAssetStatus(work.posterStatus, base.posterStatus);
      const coverStatus = normalizeAssetStatus(work.coverStatus, posterStatus);
      const videoStatus = normalizeAssetStatus(work.videoStatus, primaryClip?.status || ASSET_STATUS.missing);
      const audioStatus = normalizeAssetStatus(
        work.audioStatus,
        audioSrc ? base.audioStatus || ASSET_STATUS.placeholder : ASSET_STATUS.missing,
      );
      const category = String(work.category ?? base.category ?? 'AMV / MOTION STUDY');
      const year = String(work.year ?? base.year ?? '2026');
      const description = String(work.description ?? work.shortDescription ?? base.description ?? '');
      const shortDescription = String(work.shortDescription ?? description);
      const rawFrameNotes = Array.isArray(work.frameNotes) ? work.frameNotes : base.frameNotes;
      const rawInfoSections = Array.isArray(work.infoSections) ? work.infoSections : base.infoSections;

      return {
        ...base,
        ...work,
        id: makeUniqueId(work.id, index, usedIds),
        order: index + 1,
        index: String(index + 1).padStart(2, '0'),
        number: String(index + 1).padStart(3, '0'),
        category,
        year,
        meta: String(work.meta ?? [category, year].filter(Boolean).join(' / ')),
        description,
        shortDescription,
        infoDescription: String(work.infoDescription ?? base.infoDescription ?? description),
        infoSections: rawInfoSections.filter(Boolean).slice(0, 3).map((section, sectionIndex) => ({
          label: String(section.label ?? `NOTE ${sectionIndex + 1}`),
          body: String(section.body ?? ''),
        })),
        frameNotes: rawFrameNotes.filter(Boolean).map((note, noteIndex) => ({
          timecode: String(note.timecode ?? `00:${String(noteIndex * 6).padStart(2, '0')}`),
          note: String(note.note ?? ''),
        })),
        mixDirection: String(work.mixDirection ?? base.mixDirection ?? ''),
        accent: String(work.accent ?? work.accentColor ?? base.accent ?? '#a8a8a8'),
        accentColor: String(work.accentColor ?? work.accent ?? base.accentColor ?? '#a8a8a8'),
        transitionMood: String(work.transitionMood ?? base.transitionMood ?? 'soft'),
        coverImage,
        posterSrc,
        videoSrc,
        audioSrc,
        poster: migrateLegacyPoster(work.poster ?? coverImage, base.poster ?? coverImage),
        posterStatus,
        coverStatus,
        videoStatus,
        audioStatus,
        mediaNote: String(work.mediaNote ?? base.mediaNote ?? '未完成授权核验的测试媒体，仅用于本地视觉与交互验证。'),
        mediaFocalPoint: String(work.mediaFocalPoint ?? base.mediaFocalPoint ?? '50% 50%'),
        posterFocalPoint: String(work.posterFocalPoint ?? base.posterFocalPoint ?? work.mediaFocalPoint ?? '50% 50%'),
        copySide: work.copySide === 'right' ? 'right' : 'left',
        clips,
      };
    });

  return {
    ...fallback,
    ...input,
    motion: sanitizeMotion(input.motion),
    works: works.length ? works : fallback.works.slice(0, 1),
  };
};
