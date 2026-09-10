import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(currentDir, '..');
const publicDir = resolve(projectDir, 'public');
const manifestPath = resolve(currentDir, 'pages-assets.sha256');
const mediaOrigin = process.env.FLOWFRAME_MEDIA_ORIGIN
  || 'https://flowframe-motion-gallery.decent-bear-2585.chatgpt.site';

const entries = (await readFile(manifestPath, 'utf8'))
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [expectedHash, ...pathParts] = line.split(/\s+/);
    return { expectedHash, relativePath: pathParts.join(' ') };
  });

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function download({ expectedHash, relativePath }) {
  const destination = resolve(publicDir, relativePath);
  if (!destination.startsWith(`${publicDir}${sep}`)) {
    throw new Error(`Invalid media path: ${relativePath}`);
  }

  try {
    const existing = await readFile(destination);
    if (digest(existing) === expectedHash) return;
  } catch {
    // GitHub checkout intentionally starts without the large media files.
  }

  const response = await fetch(new URL(relativePath, `${mediaOrigin}/`));
  if (!response.ok) {
    throw new Error(`${relativePath}: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const actualHash = digest(buffer);
  if (actualHash !== expectedHash) {
    throw new Error(`${relativePath}: checksum mismatch`);
  }

  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.download`;
  await writeFile(temporary, buffer);
  await rename(temporary, destination);
}

let cursor = 0;
let completed = 0;

async function worker() {
  while (cursor < entries.length) {
    const entry = entries[cursor++];
    await download(entry);
    completed += 1;
    if (completed % 10 === 0 || completed === entries.length) {
      console.log(`FLOWFRAME media ${completed}/${entries.length}`);
    }
  }
}

await Promise.all([worker(), worker(), worker(), worker()]);
