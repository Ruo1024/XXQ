import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const publicRoot = resolve(projectRoot, 'public');
const manifestPath = resolve(projectRoot, 'scripts/pages-assets.sha256');

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }));
  return nested.flat();
};

const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');
const files = (await listFiles(publicRoot)).sort((a, b) => a.localeCompare(b, 'en'));
const lines = await Promise.all(files.map(async (path) => {
  const relativePath = relative(publicRoot, path).split('\\').join('/');
  return `${digest(await readFile(path))}  ${relativePath}`;
}));

await writeFile(manifestPath, `${lines.join('\n')}\n`);
console.log(`已更新 ${lines.length} 个公开素材哈希：${manifestPath}`);

