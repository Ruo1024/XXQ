import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(tmpdir(), 'flowframe-crf-evaluation');
const reportPath = resolve(projectRoot, 'output/qa/publish-media/crf-evaluation.json');
const crfs = [24, 26, 28, 30];
const concurrency = 4;
const works = [
  { slug: 'cigarette-and-her', source: 'media/source/user-supplied/cigarette-and-her-original.mp4', windows: [28.4, 68.3, 158.9] },
  { slug: 'eva', source: 'media/source/downloaded/eva/source.mp4', windows: [83, 159, 190] },
  { slug: 'kaguya', source: 'media/source/downloaded/kaguya/source.mp4', windows: [60, 100, 180] },
  { slug: 'liz-and-blue-bird', source: 'media/source/downloaded/liz-and-blue-bird/source.mp4', windows: [23, 121, 181] },
  { slug: 'ave-mujica', source: 'media/source/downloaded/ave-mujica/source.mp4', windows: [4, 28, 100] },
];

const run = (command, args) => new Promise((resolvePromise, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) resolvePromise(`${stdout}${stderr}`);
    else reject(new Error(`${command} 失败（${code}）：${stderr || stdout}`));
  });
});

await mkdir(outputDirectory, { recursive: true });
await mkdir(resolve(reportPath, '..'), { recursive: true });

const tasks = works.flatMap((work) => work.windows.flatMap((start) => crfs.map((crf) => ({ work, start, crf }))));
const results = [];
let cursor = 0;

const worker = async () => {
  while (cursor < tasks.length) {
    const task = tasks[cursor++];
    const { work, start, crf } = task;
    const output = resolve(outputDirectory, `${work.slug}-${String(start).replace('.', '_')}-crf${crf}.mp4`);
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', String(start), '-t', '6', '-i', resolve(projectRoot, work.source),
      '-map', '0:v:0', '-an', '-vf', 'scale=1920:1080:flags=lanczos',
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(crf),
      '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p',
      output,
    ]);
    const ssimOutput = await run('ffmpeg', [
      '-hide_banner', '-nostats', '-loglevel', 'info',
      '-ss', String(start), '-t', '6', '-i', resolve(projectRoot, work.source),
      '-i', output,
      '-filter_complex', '[0:v]scale=1920:1080:flags=lanczos,setpts=PTS-STARTPTS[reference];[1:v]setpts=PTS-STARTPTS[encoded];[reference][encoded]ssim',
      '-an', '-f', 'null', '-',
    ]);
    const match = ssimOutput.match(/All:([0-9.]+)/);
    if (!match) throw new Error(`${work.slug} ${start} CRF ${crf}: 无法读取 SSIM。`);
    results.push({
      slug: work.slug,
      startSeconds: start,
      durationSeconds: 6,
      crf,
      ssim: Number(match[1]),
      sizeBytes: (await stat(output)).size,
    });
    console.log(`${work.slug} ${start}s CRF ${crf}: SSIM ${match[1]}`);
  }
};

await Promise.all(Array.from({ length: concurrency }, worker));
results.sort((a, b) => a.slug.localeCompare(b.slug) || a.crf - b.crf || a.startSeconds - b.startSeconds);

const summary = works.map((work) => ({
  slug: work.slug,
  candidates: crfs.map((crf) => {
    const samples = results.filter((row) => row.slug === work.slug && row.crf === crf);
    return {
      crf,
      averageSsim: samples.reduce((sum, row) => sum + row.ssim, 0) / samples.length,
      minimumSsim: Math.min(...samples.map((row) => row.ssim)),
      averageBitrateKbps: samples.reduce((sum, row) => sum + (row.sizeBytes * 8 / row.durationSeconds / 1000), 0) / samples.length,
      samples,
    };
  }),
}));

await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), crfs, summary }, null, 2)}\n`);
console.log(`候选报告：${reportPath}`);

