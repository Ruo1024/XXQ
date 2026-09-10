import { mkdir, rm, writeFile, readdir, stat, open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMediaWorker } from './sites-media-worker.mjs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(currentDir, '..');
const serverDir = resolve(projectDir, 'dist/server');

const clientDir = resolve(projectDir, 'dist/client');
const mediaIndex = {};
const chunkSize = 16 * 1024 * 1024;
async function splitLargeVideos(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { await splitLargeVideos(path); continue; }
    if (!entry.name.endsWith('.mp4')) continue;
    const { size } = await stat(path);
    if (size <= 24 * 1024 * 1024) continue;
    const hash = createHash('sha256');
    for await (const bytes of createReadStream(path)) hash.update(bytes);
    const digest = hash.digest('hex');
    const partsDir = resolve(clientDir, 'media/parts', digest);
    await mkdir(partsDir, { recursive: true });
    const source = await open(path, 'r');
    const parts = [];
    try {
      for (let position = 0, part = 0; position < size; position += chunkSize, part++) {
        const buffer = Buffer.alloc(Math.min(chunkSize, size - position));
        let offset = 0;
        while (offset < buffer.length) {
          const result = await source.read(buffer, offset, buffer.length - offset, position + offset);
          if (!result.bytesRead) throw new Error(`Truncated source: ${path}`);
          offset += result.bytesRead;
        }
        const partPath = resolve(partsDir, `${part}.bin`);
        await writeFile(partPath, buffer);
        parts.push(`/${relative(clientDir, partPath)}`);
      }
    } finally { await source.close(); }
    mediaIndex[`/${relative(clientDir, path)}`] = { size, hash: digest, chunkSize, parts };
    // Only remove the generated build copy. Original and public media remain.
    await rm(path);
  }
}
if (process.env.GITHUB_PAGES !== 'true') await splitLargeVideos(clientDir);
const workerSource = `${createMediaWorker.toString()}\nexport default createMediaWorker(${JSON.stringify(mediaIndex)});\n`;

const workerConfig = {
  name: 'flowframe-motion-gallery',
  main: 'index.js',
  compatibility_date: '2026-05-15',
  compatibility_flags: [],
  assets: {
    directory: '../client',
    binding: 'ASSETS',
    not_found_handling: 'single-page-application',
    run_worker_first: Object.keys(mediaIndex).length ? Object.keys(mediaIndex) : false,
  },
};

await mkdir(serverDir, { recursive: true });
await writeFile(resolve(serverDir, 'index.js'), workerSource, 'utf8');
await writeFile(
  resolve(serverDir, 'wrangler.json'),
  `${JSON.stringify(workerConfig, null, 2)}\n`,
  'utf8',
);

// sites() writes metadata into Vite's configured output directory. The Sites
// packaging step places the authoritative copy at dist/.openai, so the client
// copy is unnecessary and should not be served as a public asset.
await rm(resolve(projectDir, 'dist/client/.openai'), { recursive: true, force: true });
