import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(currentDir, '..');
const serverDir = resolve(projectDir, 'dist/server');

const workerSource = `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`;

const workerConfig = {
  name: 'flowframe-motion-gallery',
  main: 'index.js',
  compatibility_date: '2026-05-15',
  compatibility_flags: [],
  assets: {
    directory: '../client',
    binding: 'ASSETS',
    not_found_handling: 'single-page-application',
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
