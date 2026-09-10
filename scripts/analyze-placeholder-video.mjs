#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..');
const outputRoot = resolve(workspaceRoot, 'output/qa/media-analysis');

const batchSources = Object.freeze([
  { slug: 'eva', input: 'media/source/downloaded/eva/source.mp4' },
  { slug: 'kaguya', input: 'media/source/downloaded/kaguya/source.mp4' },
  { slug: 'liz-and-blue-bird', input: 'media/source/downloaded/liz-and-blue-bird/source.mp4' },
  { slug: 'ave-mujica', input: 'media/source/downloaded/ave-mujica/source.mp4' },
]);

const userDecisionsBySlug = Object.freeze({
  eva: Object.freeze({
    cropDecision: 'keep-original-full-frame',
    crop: '3840:2160:0:0',
    reason: '用户决定保留原始 16:9 全画幅和右上水印；不为去除 Bilibili/上传者水印而破坏构图。',
    introDecision: '片头无关信息仍需根据候选点人工确认并裁掉。',
  }),
});

const settings = Object.freeze({
  cropSampleCount: 12,
  cropFramesPerSample: 14,
  cropSampleFps: 7,
  cropLimit: 0.08,
  cropRound: 2,
  cropOutlierToleranceRatio: 1 / 30,
  cropClusterEdgeTolerance: 8,
  contactFrameCount: 12,
  contactColumns: 4,
  contactCellWidth: 320,
  contactCellHeight: 180,
  sceneScaleWidth: 640,
  sceneThreshold: 0.28,
  blackDetectDuration: 0.25,
  blackPictureThreshold: 0.98,
  blackPixelThreshold: 0.1,
});

const activeChildren = new Set();

const usage = `FLOWFRAME PLACEHOLDER MEDIA 视频分析

用法：
  node scripts/analyze-placeholder-video.mjs --input <视频路径> [--slug <输出名>]
  node scripts/analyze-placeholder-video.mjs --batch

输出：
  output/qa/media-analysis/<slug>/<UTC 运行时间>/analysis.json
  output/qa/media-analysis/<slug>/<UTC 运行时间>/timeline-contact-sheet.jpg

说明：
  - 只读取源视频，不裁切、不转码、不覆盖。
  - JSON 只输出人工复核候选，不代表最终裁切决定。
  - --batch 固定检查 EVA、超时空辉夜姬、利兹与青鸟、Ave Mujica 四个 source.mp4。`;

function parseArguments(argv) {
  const result = { batch: false, input: '', slug: '', help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      result.help = true;
    } else if (argument === '--batch') {
      result.batch = true;
    } else if (argument === '--input' || argument === '-i') {
      result.input = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--slug') {
      result.slug = argv[index + 1] || '';
      index += 1;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }

  if (result.help) return result;
  if (result.batch && result.input) throw new Error('--batch 不能和 --input 同时使用。');
  if (!result.batch && !result.input) throw new Error('必须使用 --input 或 --batch。');
  if (result.slug && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(result.slug)) {
    throw new Error('--slug 只允许小写字母、数字和连字符，长度不超过 64。');
  }

  return result;
}

function asWorkspacePath(pathValue) {
  return isAbsolute(pathValue) ? resolve(pathValue) : resolve(workspaceRoot, pathValue);
}

function toReportPath(pathValue) {
  const rel = relative(workspaceRoot, pathValue);
  if (!rel.startsWith('..') && !isAbsolute(rel)) return rel.split('\\').join('/');
  return pathValue;
}

function safeSlug(pathValue) {
  const name = pathValue.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'video';
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'video';
}

function makeRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseRate(rate) {
  if (!rate || rate === '0/0') return null;
  const [numerator, denominator = '1'] = String(rate).split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return round(numerator / denominator, 6);
}

function makeTimes(duration, count, includeEdges = false) {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const edge = Math.min(2, duration * 0.02);
  const start = includeEdges ? 0 : edge;
  const end = includeEdges ? Math.max(0, duration - 0.25) : Math.max(start, duration - edge);
  if (count === 1) return [round((start + end) / 2)];
  return Array.from({ length: count }, (_, index) => round(start + ((end - start) * index) / (count - 1)));
}

function commandForReport(command, args) {
  return [command, ...args];
}

async function run(command, args, { timeoutMs = 240_000, maxOutputBytes = 24 * 1024 * 1024 } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd: workspaceRoot, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    activeChildren.add(child);

    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;
    let stopError = null;
    let forceKillTimer = null;
    let timeout = null;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);
      activeChildren.delete(child);
      callback(value);
    };

    const stopAndWait = (error) => {
      if (stopError || settled) return;
      stopError = error;
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
    };

    const collect = (target) => (chunk) => {
      const text = chunk.toString('utf8');
      outputBytes += Buffer.byteLength(text);
      if (outputBytes > maxOutputBytes) {
        stopAndWait(new Error(`${command} 输出超过安全上限。`));
        return;
      }
      if (target === 'stdout') stdout += text;
      else stderr += text;
    };

    child.stdout.on('data', collect('stdout'));
    child.stderr.on('data', collect('stderr'));
    child.once('error', (error) => finish(rejectPromise, error));
    child.once('close', (code, signal) => {
      if (stopError) {
        finish(rejectPromise, stopError);
        return;
      }
      if (code === 0) {
        finish(resolvePromise, { stdout, stderr, code, signal });
        return;
      }
      const detail = (stderr || stdout).trim().split('\n').slice(-12).join('\n');
      finish(rejectPromise, new Error(`${command} 退出 ${code ?? signal}\n${detail}`));
    });

    timeout = setTimeout(() => {
      stopAndWait(new Error(`${command} 超过 ${Math.round(timeoutMs / 1000)} 秒限时。`));
    }, timeoutMs);
  });
}

function terminateChildren() {
  for (const child of activeChildren) child.kill('SIGTERM');
}

process.once('SIGINT', () => {
  terminateChildren();
  process.exitCode = 130;
});
process.once('SIGTERM', () => {
  terminateChildren();
  process.exitCode = 143;
});

async function ensureTools() {
  await run('ffprobe', ['-version'], { timeoutMs: 10_000, maxOutputBytes: 1024 * 1024 });
  await run('ffmpeg', ['-version'], { timeoutMs: 10_000, maxOutputBytes: 1024 * 1024 });
}

async function probeMedia(inputPath) {
  const args = [
    '-v', 'error',
    '-show_entries',
    'format=format_name,duration,size,bit_rate,start_time:stream=index,codec_type,codec_name,codec_long_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,bit_rate,sample_rate,channels,channel_layout',
    '-of', 'json',
    inputPath,
  ];
  const { stdout } = await run('ffprobe', args);
  const raw = JSON.parse(stdout);
  const video = raw.streams?.find((stream) => stream.codec_type === 'video');
  const audio = raw.streams?.find((stream) => stream.codec_type === 'audio');
  const duration = Number(raw.format?.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('源文件缺少可分析的视频流或时长。');
  }

  return {
    command: commandForReport('ffprobe', args),
    durationSeconds: round(duration),
    sizeBytes: Number(raw.format?.size) || null,
    overallBitRate: Number(raw.format?.bit_rate) || null,
    formatName: raw.format?.format_name || null,
    video: {
      codec: video.codec_name || null,
      codecLongName: video.codec_long_name || null,
      profile: video.profile || null,
      width: Number(video.width) || null,
      height: Number(video.height) || null,
      pixelFormat: video.pix_fmt || null,
      nominalFps: parseRate(video.r_frame_rate),
      averageFps: parseRate(video.avg_frame_rate),
      bitRate: Number(video.bit_rate) || null,
    },
    audio: audio
      ? {
          codec: audio.codec_name || null,
          codecLongName: audio.codec_long_name || null,
          profile: audio.profile || null,
          sampleRate: Number(audio.sample_rate) || null,
          channels: Number(audio.channels) || null,
          channelLayout: audio.channel_layout || null,
          bitRate: Number(audio.bit_rate) || null,
        }
      : null,
  };
}

function parseCropLog(log) {
  const matches = [...log.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  const counts = new Map();
  for (const match of matches) {
    const crop = `${match[1]}:${match[2]}:${match[3]}:${match[4]}`;
    counts.set(crop, (counts.get(crop) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([crop, hits]) => {
      const [width, height, x, y] = crop.split(':').map(Number);
      return { crop, width, height, x, y, hits };
    })
    .sort((left, right) => right.hits - left.hits || left.crop.localeCompare(right.crop));
}

async function detectCropAt(inputPath, timeSeconds, { strategy, maxOutliers }) {
  const filter = `fps=${settings.cropSampleFps},cropdetect=limit=${settings.cropLimit}:round=${settings.cropRound}:reset=0:max_outliers=${maxOutliers}`;
  const args = [
    '-hide_banner', '-loglevel', 'info', '-nostats',
    '-ss', String(timeSeconds),
    '-i', inputPath,
    '-map', '0:v:0',
    '-frames:v', String(settings.cropFramesPerSample),
    '-vf', filter,
    '-an', '-f', 'null', '-',
  ];
  const { stderr } = await run('ffmpeg', args);
  const detections = parseCropLog(stderr);
  return {
    strategy,
    maxOutliers,
    timeSeconds,
    dominant: detections[0] || null,
    detections: detections.slice(0, 4),
    command: commandForReport('ffmpeg', args),
  };
}

function cropEdges(detection, video) {
  return {
    top: detection.y,
    right: Math.max(0, video.width - detection.x - detection.width),
    bottom: Math.max(0, video.height - detection.y - detection.height),
    left: detection.x,
  };
}

function aggregateCropCandidates(samples, video, strategy) {
  const clusters = [];
  for (const sample of samples) {
    const detection = sample.dominant;
    if (!detection) continue;
    const edges = cropEdges(detection, video);
    let cluster = clusters.find((candidate) => (
      Math.abs(candidate.referenceEdges.top - edges.top) <= settings.cropClusterEdgeTolerance
      && Math.abs(candidate.referenceEdges.right - edges.right) <= settings.cropClusterEdgeTolerance
      && Math.abs(candidate.referenceEdges.bottom - edges.bottom) <= settings.cropClusterEdgeTolerance
      && Math.abs(candidate.referenceEdges.left - edges.left) <= settings.cropClusterEdgeTolerance
    ));
    if (!cluster) {
      cluster = {
        referenceEdges: edges,
        variants: new Map(),
        frameHits: 0,
        sampleTimes: new Set(),
      };
      clusters.push(cluster);
    }
    const variant = cluster.variants.get(detection.crop) || {
      ...detection,
      hits: 0,
      edges,
      sampleTimes: new Set(),
    };
    variant.hits += detection.hits;
    variant.sampleTimes.add(sample.timeSeconds);
    cluster.variants.set(detection.crop, variant);
    cluster.frameHits += detection.hits;
    cluster.sampleTimes.add(sample.timeSeconds);
  }

  return clusters
    .map((cluster) => {
      const variants = [...cluster.variants.values()]
        .sort((left, right) => right.hits - left.hits || left.crop.localeCompare(right.crop));
      const representative = variants[0];
      const sampleTimes = [...cluster.sampleTimes].sort((a, b) => a - b);
      const sampleCoverage = samples.length ? sampleTimes.length / samples.length : 0;
      return {
        strategy,
        crop: representative.crop,
        width: representative.width,
        height: representative.height,
        x: representative.x,
        y: representative.y,
        removedPixels: representative.edges,
        sampleCoverage: round(sampleCoverage),
        sampleTimes,
        frameHits: cluster.frameHits,
        edgeTolerancePixels: settings.cropClusterEdgeTolerance,
        variants: variants.map((variant) => ({
          crop: variant.crop,
          frameHits: variant.hits,
          sampleTimes: [...variant.sampleTimes].sort((a, b) => a - b),
        })),
        stable: sampleCoverage >= 0.5,
      };
    })
    .sort((left, right) =>
      right.sampleCoverage - left.sampleCoverage
      || right.frameHits - left.frameHits,
    );
}

function parseSceneMetadata(output) {
  const candidates = [];
  let current = null;
  for (const line of output.split(/\r?\n/)) {
    const frameMatch = line.match(/^frame:(\d+)\s+pts:\S+\s+pts_time:([\d.]+)/);
    if (frameMatch) {
      if (current?.timeSeconds != null && current?.score != null) candidates.push(current);
      current = { frame: Number(frameMatch[1]), timeSeconds: round(Number(frameMatch[2]), 4), score: null };
      continue;
    }
    const scoreMatch = line.match(/^lavfi\.scene_score=([\d.]+)/);
    if (scoreMatch && current) current.score = round(Number(scoreMatch[1]), 6);
  }
  if (current?.timeSeconds != null && current?.score != null) candidates.push(current);

  return candidates.filter((candidate, index, list) => (
    index === 0 || Math.abs(candidate.timeSeconds - list[index - 1].timeSeconds) >= 0.04
  ));
}

async function detectScenes(inputPath) {
  const filter = `scale=${settings.sceneScaleWidth}:-2:flags=fast_bilinear,select='gt(scene,${settings.sceneThreshold})',metadata=mode=print:file=-`;
  const args = [
    '-hide_banner', '-loglevel', 'error', '-nostats',
    '-i', inputPath,
    '-map', '0:v:0',
    '-vf', filter,
    '-an', '-fps_mode', 'vfr', '-f', 'null', '-',
  ];
  const { stdout } = await run('ffmpeg', args, { timeoutMs: 360_000 });
  return { command: commandForReport('ffmpeg', args), candidates: parseSceneMetadata(stdout) };
}

function parseBlackDetectLog(log) {
  return [...log.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)].map((match) => ({
    startSeconds: round(Number(match[1]), 4),
    endSeconds: round(Number(match[2]), 4),
    durationSeconds: round(Number(match[3]), 4),
  }));
}

async function detectIntroBlack(inputPath, duration) {
  const introWindowSeconds = round(Math.min(30, Math.max(8, duration * 0.18)));
  const filter = `scale=${settings.sceneScaleWidth}:-2:flags=fast_bilinear,blackdetect=d=${settings.blackDetectDuration}:pic_th=${settings.blackPictureThreshold}:pix_th=${settings.blackPixelThreshold}`;
  const args = [
    '-hide_banner', '-loglevel', 'info', '-nostats',
    '-t', String(introWindowSeconds),
    '-i', inputPath,
    '-map', '0:v:0',
    '-vf', filter,
    '-an', '-f', 'null', '-',
  ];
  const { stderr } = await run('ffmpeg', args);
  return {
    command: commandForReport('ffmpeg', args),
    introWindowSeconds,
    intervals: parseBlackDetectLog(stderr),
  };
}

function buildIntroCandidates(blackIntervals, sceneCandidates, introWindowSeconds, duration) {
  const candidates = [];

  for (const interval of blackIntervals) {
    if (interval.endSeconds > 0.2 && interval.endSeconds <= introWindowSeconds) {
      candidates.push({
        timeSeconds: interval.endSeconds,
        evidence: 'black-segment-end',
        evidenceValue: interval.durationSeconds,
        reviewWindow: [round(Math.max(0, interval.endSeconds - 1)), round(Math.min(duration, interval.endSeconds + 1.5))],
      });
    }
  }

  const strongestEarlyScenes = sceneCandidates
    .filter((candidate) => candidate.timeSeconds >= 0.4 && candidate.timeSeconds <= introWindowSeconds)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);

  for (const scene of strongestEarlyScenes) {
    candidates.push({
      timeSeconds: scene.timeSeconds,
      evidence: 'early-scene-change',
      evidenceValue: scene.score,
      reviewWindow: [round(Math.max(0, scene.timeSeconds - 1)), round(Math.min(duration, scene.timeSeconds + 1.5))],
    });
  }

  const deduplicated = [];
  for (const candidate of candidates.sort((left, right) => left.timeSeconds - right.timeSeconds)) {
    const existing = deduplicated.find((item) => Math.abs(item.timeSeconds - candidate.timeSeconds) < 0.12);
    if (!existing) {
      deduplicated.push(candidate);
    } else if (!existing.relatedEvidence) {
      existing.relatedEvidence = [candidate.evidence];
    } else {
      existing.relatedEvidence.push(candidate.evidence);
    }
  }
  return deduplicated;
}

function makeContactLayout(frameCount, columns, cellWidth, cellHeight) {
  return Array.from({ length: frameCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return `${column * cellWidth}_${row * cellHeight}`;
  }).join('|');
}

async function createContactSheet(inputPath, outputPath, duration) {
  const times = makeTimes(duration, settings.contactFrameCount, true);
  const args = ['-hide_banner', '-loglevel', 'error', '-nostats'];
  for (const time of times) args.push('-ss', String(time), '-i', inputPath);

  const chains = times.map((_, index) => (
    `[${index}:v]scale=w=${settings.contactCellWidth}:h=${settings.contactCellHeight}:force_original_aspect_ratio=decrease:flags=lanczos,`
    + `pad=${settings.contactCellWidth}:${settings.contactCellHeight}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${index}]`
  ));
  const inputs = times.map((_, index) => `[v${index}]`).join('');
  const rows = Math.ceil(times.length / settings.contactColumns);
  const layout = makeContactLayout(
    times.length,
    settings.contactColumns,
    settings.contactCellWidth,
    settings.contactCellHeight,
  );
  chains.push(`${inputs}xstack=inputs=${times.length}:layout=${layout}:fill=0x151515[sheet]`);

  args.push(
    '-filter_complex', chains.join(';'),
    '-map', '[sheet]',
    '-frames:v', '1',
    '-q:v', '4',
    '-n', outputPath,
  );
  await run('ffmpeg', args);
  return {
    command: commandForReport('ffmpeg', args),
    path: toReportPath(outputPath),
    columns: settings.contactColumns,
    rows,
    cellWidth: settings.contactCellWidth,
    cellHeight: settings.contactCellHeight,
    nominalFrameTimesSeconds: times,
  };
}

async function allocateRunDirectory(slug, runId) {
  const slugRoot = resolve(outputRoot, slug);
  await mkdir(slugRoot, { recursive: true });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt ? `-${String(attempt).padStart(2, '0')}` : '';
    const candidate = resolve(slugRoot, `${runId}${suffix}`);
    try {
      await mkdir(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new Error(`无法为 ${slug} 创建唯一输出目录。`);
}

async function writeJson(pathValue, value) {
  await writeFile(pathValue, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

async function analyzeSource({ slug, input }, runId) {
  const inputPath = asWorkspacePath(input);
  const sourceStat = await stat(inputPath);
  if (!sourceStat.isFile()) throw new Error(`不是普通文件：${inputPath}`);

  const runDirectory = await allocateRunDirectory(slug, runId);
  const reportPath = resolve(runDirectory, 'analysis.json');
  const contactSheetPath = resolve(runDirectory, 'timeline-contact-sheet.jpg');

  console.log(`[${slug}] ffprobe`);
  const probe = await probeMedia(inputPath);

  console.log(`[${slug}] cropdetect ${settings.cropSampleCount} 个时间点（严格 + 容错）`);
  const cropTimes = makeTimes(probe.durationSeconds, settings.cropSampleCount);
  const cropOutlierTolerance = Math.max(4, Math.round(probe.video.width * settings.cropOutlierToleranceRatio));
  const strictCropSamples = [];
  const tolerantCropSamples = [];
  for (const timeSeconds of cropTimes) {
    strictCropSamples.push(await detectCropAt(inputPath, timeSeconds, {
      strategy: 'strict-black-border',
      maxOutliers: 0,
    }));
    tolerantCropSamples.push(await detectCropAt(inputPath, timeSeconds, {
      strategy: 'watermark-subtitle-tolerant-black-border',
      maxOutliers: cropOutlierTolerance,
    }));
  }
  const strictCropCandidates = aggregateCropCandidates(strictCropSamples, probe.video, 'strict-black-border');
  const tolerantCropCandidates = aggregateCropCandidates(
    tolerantCropSamples,
    probe.video,
    'watermark-subtitle-tolerant-black-border',
  );

  console.log(`[${slug}] 全片场景变化候选`);
  const sceneDetection = await detectScenes(inputPath);

  console.log(`[${slug}] 片头黑场候选`);
  const blackDetection = await detectIntroBlack(inputPath, probe.durationSeconds);

  console.log(`[${slug}] 时间线联系表`);
  const contactSheet = await createContactSheet(inputPath, contactSheetPath, probe.durationSeconds);

  const introTrimCandidates = buildIntroCandidates(
    blackDetection.intervals,
    sceneDetection.candidates,
    blackDetection.introWindowSeconds,
    probe.durationSeconds,
  );

  const userDecision = userDecisionsBySlug[slug] || null;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    assetLabel: 'PLACEHOLDER MEDIA',
    decisionStatus: userDecision ? 'user-crop-decision-plus-trim-candidates' : 'candidate-only',
    finalTrimSelected: false,
    finalCropSelected: Boolean(userDecision),
    userDecision,
    source: {
      slug,
      path: toReportPath(inputPath),
      sizeBytes: sourceStat.size,
      modifiedAt: sourceStat.mtime.toISOString(),
      readOnlyAnalysis: true,
    },
    media: probe,
    requirementsChecks: {
      videoCodecIsH264: probe.video.codec === 'h264',
      audioStreamPresent: Boolean(probe.audio),
      highestAvailableQualityRequiresDownloadMetadataReview: true,
    },
    analysisSettings: settings,
    evidence: {
      contactSheet,
      cropSamples: {
        strict: strictCropSamples,
        watermarkSubtitleTolerant: tolerantCropSamples,
      },
      earlyBlackIntervals: blackDetection.intervals,
      commands: {
        sceneDetection: sceneDetection.command,
        introBlackDetection: blackDetection.command,
      },
    },
    candidates: {
      introTrimCandidates,
      stableCropCandidates: userDecision
        ? []
        : tolerantCropCandidates.filter((candidate) => candidate.stable).slice(0, 8),
      cropCandidates: tolerantCropCandidates.slice(0, 16),
      strictCropCandidates: strictCropCandidates.slice(0, 16),
      sceneChangeCandidates: sceneDetection.candidates,
    },
    manualReview: {
      required: true,
      instructions: [
        '在时间线联系表和原片中复核片头语义，再决定开始时间。',
        'cropdetect 只擅长识别近黑边缘；字幕、Bilibili 标记和画面构图需要人工复核。',
        '稳定 crop 候选不是最终参数，不应直接用于成品转码。',
        '从场景变化候选中人工挑选内容完整、无平台标记的切片区间。',
        ...(userDecision ? ['EVA 已由用户决定保留原始 16:9 全画幅和水印；禁止把自动 crop 候选用于 EVA 成品。'] : []),
      ],
    },
  };

  await writeJson(reportPath, report);
  console.log(`[${slug}] 完成：${toReportPath(reportPath)}`);
  return {
    slug,
    input: toReportPath(inputPath),
    report: toReportPath(reportPath),
    contactSheet: toReportPath(contactSheetPath),
    videoCodec: probe.video.codec,
    resolution: `${probe.video.width}×${probe.video.height}`,
    fps: probe.video.averageFps,
    durationSeconds: probe.durationSeconds,
    stableCropCandidateCount: report.candidates.stableCropCandidates.length,
    sceneChangeCandidateCount: report.candidates.sceneChangeCandidates.length,
    introTrimCandidateCount: report.candidates.introTrimCandidates.length,
  };
}

async function pathExists(pathValue) {
  try {
    await stat(pathValue);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function runBatch(runId) {
  const summaryDirectory = await allocateRunDirectory('batch', runId);
  const results = [];
  const missing = [];
  const errors = [];

  for (const source of batchSources) {
    const inputPath = asWorkspacePath(source.input);
    if (!(await pathExists(inputPath))) {
      missing.push({ slug: source.slug, input: source.input });
      console.warn(`[${source.slug}] 缺少：${source.input}`);
      continue;
    }
    try {
      results.push(await analyzeSource(source, runId));
    } catch (error) {
      errors.push({ slug: source.slug, input: source.input, message: error.message });
      console.error(`[${source.slug}] 失败：${error.message}`);
    }
  }

  const summaryPath = resolve(summaryDirectory, 'batch-summary.json');
  await writeJson(summaryPath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    assetLabel: 'PLACEHOLDER MEDIA',
    decisionStatus: 'candidate-only',
    requestedSources: batchSources,
    analyzed: results,
    missing,
    errors,
  });
  console.log(`批量摘要：${toReportPath(summaryPath)}`);
  if (errors.length) process.exitCode = 1;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(`\n${usage}`);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(usage);
    return;
  }

  await ensureTools();
  await mkdir(outputRoot, { recursive: true });
  const runId = makeRunId();

  if (options.batch) {
    await runBatch(runId);
    return;
  }

  const inputPath = asWorkspacePath(options.input);
  const slug = options.slug || safeSlug(inputPath);
  await analyzeSource({ slug, input: inputPath }, runId);
}

main().catch((error) => {
  terminateChildren();
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
