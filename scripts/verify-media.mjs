import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const errors = [];

const THEMES = [
  {
    slug: 'eva',
    source: 'media/source/downloaded/eva/source.mp4',
    clipSize: [1920, 1080],
    fps: 24,
    detailSize: [1920, 1080],
    audio: 'public/media/audio/eva-bgm.m4a',
  },
  {
    slug: 'kaguya',
    source: 'media/source/downloaded/kaguya/source.mp4',
    clipSize: [1920, 764],
    fps: 60,
    detailSize: [1920, 764],
    audio: 'public/media/audio/kaguya-bgm.m4a',
  },
  {
    slug: 'liz-and-blue-bird',
    source: 'media/source/downloaded/liz-and-blue-bird/source.mp4',
    clipSize: [1920, 764],
    fps: 60,
    detailSize: [1920, 764],
    audio: 'public/media/audio/liz-and-blue-bird-bgm.m4a',
  },
  {
    slug: 'ave-mujica',
    source: 'media/source/downloaded/ave-mujica/source.mp4',
    clipSize: [1920, 800],
    fps: 60,
    detailSize: [1920, 800],
    audio: 'public/media/audio/ave-mujica-bgm.m4a',
  },
];

const HOME_POSTERS = [
  'public/media/works/cigarette-and-her/home-poster.webp',
  ...THEMES.map((theme) => `public/media/works/${theme.slug}/home-poster.webp`),
];

const absolute = (relativePath) => resolve(projectRoot, relativePath);

const probe = (relativePath) => {
  try {
    return JSON.parse(execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries',
      'format=format_name,duration,size:stream=index,codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,sample_rate,channels',
      '-of', 'json',
      absolute(relativePath),
    ], { encoding: 'utf8' }));
  } catch (error) {
    errors.push(`${relativePath}: ffprobe 失败：${error.message}`);
    return { streams: [], format: {} };
  }
};

const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const parseRate = (value) => {
  const [numerator, denominator = '1'] = String(value || '0/1').split('/').map(Number);
  return denominator ? numerator / denominator : 0;
};

const assertFastStart = async (relativePath) => {
  const buffer = await readFile(absolute(relativePath));
  const moov = buffer.indexOf(Buffer.from('moov'));
  const mdat = buffer.indexOf(Buffer.from('mdat'));
  assert(moov >= 0 && mdat >= 0 && moov < mdat, `${relativePath}: moov 不在 mdat 前，faststart 无效。`);
};

for (const posterPath of HOME_POSTERS) {
  const result = probe(posterPath);
  const image = result.streams.find((stream) => stream.codec_type === 'video');
  assert(image?.codec_name === 'webp', `${posterPath}: 主页海报不是 WebP。`);
  assert(image?.width === 1000 && image?.height === 1600, `${posterPath}: 主页海报不是 1000×1600。`);
}

for (const theme of THEMES) {
  const sourceResult = probe(theme.source);
  const sourceVideo = sourceResult.streams.find((stream) => stream.codec_type === 'video');
  const sourceAudio = sourceResult.streams.find((stream) => stream.codec_type === 'audio');
  assert(sourceVideo?.codec_name === 'h264', `${theme.source}: 原片不是 H.264。`);
  assert(sourceVideo?.width === 3840 && sourceVideo?.height === 2160, `${theme.source}: 原片不是 3840×2160。`);
  assert(sourceVideo?.pix_fmt === 'yuv420p', `${theme.source}: 原片不是 yuv420p。`);
  assert(sourceAudio?.codec_name === 'aac', `${theme.source}: 原片音频不是 AAC。`);

  const detailPath = `public/media/works/${theme.slug}/detail-poster.webp`;
  const detailResult = probe(detailPath);
  const detail = detailResult.streams.find((stream) => stream.codec_type === 'video');
  assert(detail?.codec_name === 'webp', `${detailPath}: 详情封面不是 WebP。`);
  assert(
    detail?.width === theme.detailSize[0] && detail?.height === theme.detailSize[1],
    `${detailPath}: 详情封面尺寸错误。`,
  );

  for (let index = 1; index <= 3; index += 1) {
    const clipPath = `public/media/works/${theme.slug}/segments/segment-0${index}.mp4`;
    const clipResult = probe(clipPath);
    const videos = clipResult.streams.filter((stream) => stream.codec_type === 'video');
    const audios = clipResult.streams.filter((stream) => stream.codec_type === 'audio');
    const video = videos[0];
    const duration = Number(clipResult.format.duration);
    assert(videos.length === 1 && audios.length === 0, `${clipPath}: 切片必须只有一个视频流且没有音频流。`);
    assert(video?.codec_name === 'h264' && video?.profile === 'High', `${clipPath}: 切片不是 H.264 High。`);
    assert(video?.pix_fmt === 'yuv420p', `${clipPath}: 切片不是 yuv420p。`);
    assert(
      video?.width === theme.clipSize[0] && video?.height === theme.clipSize[1],
      `${clipPath}: 切片尺寸错误。`,
    );
    assert(Math.abs(parseRate(video?.avg_frame_rate) - theme.fps) < 0.01, `${clipPath}: 切片帧率错误。`);
    assert(duration >= 5.95 && duration <= 6.05, `${clipPath}: 切片时长不是约 6 秒。`);
    await assertFastStart(clipPath);
  }

  const audioResult = probe(theme.audio);
  const audioStreams = audioResult.streams.filter((stream) => stream.codec_type === 'audio');
  const videoStreams = audioResult.streams.filter((stream) => stream.codec_type === 'video');
  assert(audioStreams.length === 1 && videoStreams.length === 0, `${theme.audio}: BGM 必须只有一个音频流。`);
  assert(audioStreams[0]?.codec_name === 'aac', `${theme.audio}: BGM 不是 AAC。`);
  assert(Number(audioResult.format.duration) > 120, `${theme.audio}: BGM 时长异常。`);
  await assertFastStart(theme.audio);
}

if (errors.length) {
  throw new Error(`FLOWFRAME media verification failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
}

console.log('FLOWFRAME media verification passed.');

