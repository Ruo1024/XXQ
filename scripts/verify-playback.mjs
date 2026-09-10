import assert from 'node:assert/strict';
import { createMediaWorker } from './sites-media-worker.mjs';
import { createDefaultProject, resolveWorkMedia, resolveWorkPlayback } from '../src/data/project-contract.js';
import { migrateProject } from '../src/data/project-store.js';
import { hydrateProjectAssets } from '../src/data/runtime-project.js';

const defaults = createDefaultProject();
for (const work of defaults.works) {
  assert.match(resolveWorkPlayback(work).src, /\/playback\.mp4$/);
  assert.equal(resolveWorkMedia(work).sources.length, 3);
  assert(resolveWorkMedia(work).sources.every((src) => src.includes('/segments/')));
  assert.equal(resolveWorkPlayback({ ...work, videoSrc: '' }).src, '');
  const legacy = structuredClone(defaults);
  legacy.version = 5;
  legacy.works = [{ ...work, videoSrc: work.clips[0].src }];
  assert.equal(migrateProject(legacy).works[0].videoSrc, work.videoSrc);
  legacy.works[0].videoSrc = 'idb://flowframe/custom-video';
  assert.equal(migrateProject(legacy).works[0].videoSrc, 'idb://flowframe/custom-video');
}
const uploaded = structuredClone(defaults);
uploaded.works[0].videoSrc = 'idb://flowframe/custom-video';
const runtime = await hydrateProjectAssets(uploaded, { resolve: async () => 'blob:https://example.test/full-video' });
assert.equal(resolveWorkPlayback(runtime.works[0]).src, 'blob:https://example.test/full-video');
assert(resolveWorkMedia(runtime.works[0]).sources.every((src) => src.includes('/segments/')));

const bytes = Uint8Array.from({ length: 53 }, (_, index) => index + 30);
const chunkSize = 7;
const parts = Array.from({ length: Math.ceil(bytes.length / chunkSize) }, (_, index) => `/parts/${index}.bin`);
const worker = createMediaWorker({ '/playback.mp4': { hash: 'test-hash', size: bytes.length, chunkSize, parts } });
for (const supportsRange of [true, false]) {
  const env = { ASSETS: { fetch: async (request) => {
    const part = parts.indexOf(new URL(request.url).pathname);
    if (part < 0) return new Response('ordinary asset');
    let body = bytes.slice(part * chunkSize, (part + 1) * chunkSize);
    const range = request.headers.get('Range');
    if (supportsRange && range) {
      const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(range);
      body = body.slice(Number(from), Number(to) + 1);
    }
    // Exercise slicing when the underlying body arrives in several reads.
    let offset = 0;
    return new Response(new ReadableStream({ pull(controller) {
      if (offset >= body.length) { controller.close(); return; }
      controller.enqueue(body.slice(offset, offset + 3));
      offset += 3;
    } }), { status: supportsRange && range ? 206 : 200 });
  } } };
  for (const [range, from, to] of [[null, 0, 52], ['bytes=0-0', 0, 0], ['bytes=5-24', 5, 24], ['bytes=50-', 50, 52], ['bytes=-9', 44, 52], ['bytes=51-100', 51, 52]]) {
    const response = await worker.fetch(new Request('https://example.test/playback.mp4', { headers: range ? { Range: range } : {} }), env);
    assert.equal(response.status, range ? 206 : 200);
    assert.equal(Number(response.headers.get('Content-Length')), to - from + 1);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(from, to + 1));
  }
  for (const range of ['bytes=53-', 'bytes=9-2', 'bytes=-0', 'bytes=abc', 'bytes=0-1,4-5']) {
    const response = await worker.fetch(new Request('https://example.test/playback.mp4', { headers: { Range: range } }), env);
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */53');
  }
  const head = await worker.fetch(new Request('https://example.test/playback.mp4', { method: 'HEAD' }), env);
  assert.equal(head.headers.get('Content-Length'), '53');
  assert.equal(await head.text(), '');
  const stale = await worker.fetch(new Request('https://example.test/playback.mp4', { headers: { Range: 'bytes=0-0', 'If-Range': 'old-hash' } }), env);
  assert.equal(stale.status, 200);
  assert.deepEqual(new Uint8Array(await stale.arrayBuffer()), bytes);
  const cached = await worker.fetch(new Request('https://example.test/playback.mp4', { headers: { 'If-None-Match': '"test-hash"' } }), env);
  assert.equal(cached.status, 304);
  assert.equal(await (await worker.fetch(new Request('https://example.test/ordinary'), env)).text(), 'ordinary asset');
}
console.log('PASS: full-video/preview separation, v5 migration, custom upload hydration, streaming ranges, HEAD and cache validation.');
