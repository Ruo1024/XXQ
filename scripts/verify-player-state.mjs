// Exercise playback/transition cancellation without a browser or real media.
import assert from 'node:assert/strict';
import { setMaxListeners } from 'node:events';
import { createWorkPlayer } from '../src/detail/work-player.js';
setMaxListeners(0);
class Element extends EventTarget {
  constructor() { super(); this.style = {}; this.dataset = {}; this.attributes = {}; this.hidden = false; this.children = {}; }
  querySelector(selector) { return this.children[selector] || null; }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] || null; }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'src') this.src = ''; }
  getBoundingClientRect() { return { x: 600, y: 400, width: 150, height: 150 }; }
  focus() { document.activeElement = this; this.lastFocusSuppressedInk = this.dataset.playerReturnFocus === 'true'; }
  animate() {
    let reject;
    const finished = new Promise((resolve, failure) => { reject = failure; setTimeout(resolve, 2); });
    return { finished, cancel() { reject(new Error('canceled')); } };
  }
}
class Video extends Element {
  paused = true;
  duration = 240;
  currentTime = 0;
  readyState = 0;
  volume = 1;
  getAttribute(name) { return name === 'src' ? this.src : super.getAttribute(name); }
  load() {
    if (this.src) queueMicrotask(() => { this.readyState = 2; this.dispatchEvent(new Event('loadeddata')); this.dispatchEvent(new Event('durationchange')); });
  }
  async play() { this.paused = false; this.dispatchEvent(new Event('play')); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
}
const selectors = ['[data-detail-player]', '[data-detail-player-close]', '[data-player-toggle]', '[data-player-progress]', '[data-player-volume]', '[data-player-message]', '.work-player-wipe', '.work-player-wipe__disc'];
const elements = Object.fromEntries(selectors.map((name) => [name, new Element()]));
const video = elements['[data-detail-player-video]'] = new Video();
const back = elements['[data-detail-player-close]'];
back.children['.work-play__ink'] = new Element();
const play = new Element();
play.children.filter = { id: 'ink' };
const controls = new Element();
globalThis.document = { body: { dataset: {} }, querySelector: () => controls, activeElement: play };
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
let entered = 0;
let left = 0;
let suspended = false;
const player = createWorkPlayer({ root: { querySelector: (selector) => elements[selector] }, playButton: play,
  reducedMotion: false, onEnter() { entered++; }, onLeave() { left++; },
  audioController: { suspend() { suspended = true; }, resume() { suspended = false; } },
});
assert(await player.open({ src: '/full.mp4' }));
assert.equal(entered, 1);
assert.equal(video.src, '/full.mp4');
assert.equal(video.loop, false);
assert.equal(video.paused, false);
assert.equal(suspended, true);
assert.equal(elements['[data-detail-player]'].dataset.controls, 'hidden');
assert.equal(elements['.work-player-wipe'].hidden, true);
elements['[data-player-toggle]'].dispatchEvent(new Event('click'));
assert.equal(video.paused, true);
elements['[data-player-progress]'].value = '50';
elements['[data-player-progress]'].dispatchEvent(new Event('input'));
assert.equal(video.currentTime, 120);
elements['[data-player-volume]'].value = '0.25';
elements['[data-player-volume]'].dispatchEvent(new Event('input'));
assert.equal(video.volume, 0.25);
assert(await player.close());
assert.equal(left, 1);
assert.equal(video.src, '');
assert.equal(video.paused, true);
assert.equal(suspended, false);
assert.equal(document.activeElement, play);
assert.equal(play.lastFocusSuppressedInk, true);
assert.equal(play.dataset.playerReturnFocus, undefined);
assert.equal(player.isActive(), false);

// A hash/navigation change during the opening wipe must not reveal stale video.
const opening = player.open({ src: '/another.mp4' });
await player.close({ immediate: true });
assert.equal(await opening, false);
assert.equal(video.src, '');
assert.equal(elements['[data-detail-player]'].getAttribute('aria-hidden'), 'true');
assert.equal(elements['.work-player-wipe'].hidden, true);

assert(await player.open({ src: '' }));
assert.equal(video.src, '');
assert.equal(elements['[data-player-message]'].hidden, false);
assert.equal(elements['[data-player-toggle]'].disabled, true);
await player.close();
player.destroy();
assert.equal(suspended, false);
assert.equal(document.body.dataset.fullVideo, undefined);
console.log('PASS: hidden controls, full-video playback, pause/seek/volume, BACK, interrupted wipe, missing media and BGM restoration.');
