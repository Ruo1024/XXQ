import {
  ASSET_STATUS,
  DEFAULT_WORKS,
  PROJECT_LIMITS,
  createDefaultProject,
  sanitizeProject,
} from '../data/project-contract.js';
import { DEFAULT_MOTION, MOTION_GROUPS } from '../data/motion-schema.js';
import { createMediaAssetStore, isLocalMediaReference } from '../data/media-asset-store.js';
import './control-panel.css';

const SESSION_OPEN_KEY = 'flowframe-control-panel-open';
const clone = (value) => globalThis.structuredClone
  ? globalThis.structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const sameProject = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const uid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}`;

const readOpenState = () => {
  try { return sessionStorage.getItem(SESSION_OPEN_KEY) === 'true'; } catch { return false; }
};

const writeOpenState = (value) => {
  try { sessionStorage.setItem(SESSION_OPEN_KEY, String(Boolean(value))); } catch { /* Session storage is optional. */ }
};

const normalizeOrders = (project) => {
  project.works.forEach((work, index) => {
    work.order = index + 1;
    work.index = String(index + 1).padStart(2, '0');
    work.number = String(index + 1).padStart(3, '0');
  });
};

const syncPrimaryClip = (work) => {
  const primary = work?.clips?.find((clip) => clip.src) || work?.clips?.[0];
  if (!work) return;
  work.videoSrc = primary?.src || '';
  work.videoStatus = primary?.status || ASSET_STATUS.missing;
};

const makeWork = (index) => {
  const base = clone(DEFAULT_WORKS[index % DEFAULT_WORKS.length]);
  const sequence = index + 1;
  return {
    ...base,
    id: uid('work'),
    order: sequence,
    index: String(sequence).padStart(2, '0'),
    number: String(sequence).padStart(3, '0'),
    title: `新作品 ${String(sequence).padStart(2, '0')}`,
    titleEn: `NEW WORK ${String(sequence).padStart(2, '0')}`,
    poster: '',
    coverImage: '',
    posterSrc: '',
    detailStill: '',
    posterStatus: ASSET_STATUS.missing,
    coverStatus: ASSET_STATUS.missing,
    videoSrc: '',
    videoStatus: ASSET_STATUS.missing,
    audioSrc: '',
    audioStatus: ASSET_STATUS.missing,
    clips: [],
    mediaNote: 'PLACEHOLDER MEDIA · 等待替换为已获授权的正式素材。',
  };
};

const makeClip = (workIndex, clipIndex) => ({
  id: uid(`clip-${workIndex + 1}`),
  title: `CLIP ${String(clipIndex + 1).padStart(2, '0')}`,
  src: '',
  poster: '',
  tone: '#b8b8b8',
  status: ASSET_STATUS.missing,
  note: 'PLACEHOLDER MEDIA · 等待替换为已获授权的正式视频。',
});

const formatValue = (field, value) => {
  const precision = String(field.step).includes('.') ? String(field.step).split('.')[1].length : 0;
  return Number(value).toFixed(Math.min(precision, 3));
};

const previewMarkup = (kind, source, label) => {
  if (!source) return '<span class="ff-control__empty-preview">尚未设置</span>';
  const safeSource = escapeHtml(source);
  const common = `data-preview-ref="${safeSource}" data-preview-kind="${kind}"`;
  if (kind === 'image') return `<img ${common} alt="${escapeHtml(label)}" loading="lazy">`;
  if (kind === 'video') return `<video ${common} muted loop playsinline controls preload="metadata"></video>`;
  return `<audio ${common} controls preload="metadata"></audio>`;
};

const motionMarkup = (draft) => MOTION_GROUPS.map((group) => `
  <section class="ff-control__group" data-motion-group="${group.id}">
    <header class="ff-control__group-head">
      <div><h3>${escapeHtml(group.label)}</h3><p>${escapeHtml(group.description)}</p></div>
      <button type="button" class="ff-control__text-action" data-action="reset-group" data-group="${group.id}">本组重置</button>
    </header>
    <div class="ff-control__parameter-list">
      ${group.fields.map((field) => {
        const value = Number(draft.motion?.[field.key] ?? field.defaultValue);
        return `<label class="ff-control__parameter">
          <span>${escapeHtml(field.label)}</span>
          <div class="ff-control__parameter-inputs">
            <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-motion-range="${field.key}">
            <span class="ff-control__number-wrap"><input type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-motion-number="${field.key}"><em>${escapeHtml(field.unit)}</em></span>
          </div>
        </label>`;
      }).join('')}
    </div>
  </section>`).join('');

const clipMarkup = (clip, workIndex, clipIndex, clipCount) => `
  <article class="ff-control__clip">
    <div class="ff-control__media-preview ff-control__media-preview--video">
      ${previewMarkup('video', clip.src, clip.title)}
      <span>PLACEHOLDER MEDIA</span>
    </div>
    <div class="ff-control__clip-body">
      <div class="ff-control__row-head">
        <strong>${String(clipIndex + 1).padStart(2, '0')}</strong>
        <div>
          <button type="button" data-action="clip-up" data-work="${workIndex}" data-clip="${clipIndex}" ${clipIndex === 0 ? 'disabled' : ''} aria-label="片段上移">↑</button>
          <button type="button" data-action="clip-down" data-work="${workIndex}" data-clip="${clipIndex}" ${clipIndex === clipCount - 1 ? 'disabled' : ''} aria-label="片段下移">↓</button>
          <button type="button" data-action="clip-delete" data-work="${workIndex}" data-clip="${clipIndex}" aria-label="删除片段">×</button>
        </div>
      </div>
      <label><span>片段名称</span><input type="text" value="${escapeHtml(clip.title)}" data-field="clip-title" data-work="${workIndex}" data-clip="${clipIndex}"></label>
      <label><span>路径或网址</span><input type="text" value="${escapeHtml(clip.src)}" placeholder="/media/clip.mp4 或 https://…" data-field="clip-src" data-work="${workIndex}" data-clip="${clipIndex}"></label>
      <label class="ff-control__file"><span>选择本地视频</span><input type="file" accept="video/*" data-local-kind="video" data-work="${workIndex}" data-clip="${clipIndex}"></label>
    </div>
  </article>`;

const workMarkup = (work, workIndex, workCount, activeClipIndex = 0) => `
  <section class="ff-control__work" data-work-id="${escapeHtml(work.id)}">
    <header class="ff-control__work-head">
      <div><span>WORK ${String(workIndex + 1).padStart(2, '0')}</span><h3>${escapeHtml(work.title || '未命名作品')}</h3></div>
      <div class="ff-control__work-actions">
        <button type="button" data-action="work-up" data-work="${workIndex}" ${workIndex === 0 ? 'disabled' : ''} aria-label="作品上移">↑</button>
        <button type="button" data-action="work-down" data-work="${workIndex}" ${workIndex === workCount - 1 ? 'disabled' : ''} aria-label="作品下移">↓</button>
        <button type="button" data-action="work-delete" data-work="${workIndex}" ${workCount <= PROJECT_LIMITS.minWorks ? 'disabled' : ''} aria-label="删除作品">×</button>
      </div>
    </header>
    <div class="ff-control__work-fields">
      <label><span>中文标题</span><input type="text" value="${escapeHtml(work.title)}" data-field="work-title" data-work="${workIndex}"></label>
      <label><span>英文标题</span><input type="text" value="${escapeHtml(work.titleEn)}" data-field="work-title-en" data-work="${workIndex}"></label>
    </div>

    <div class="ff-control__asset-block">
      <div class="ff-control__asset-title"><strong>封面</strong><button type="button" data-action="cover-clear" data-work="${workIndex}">删除</button></div>
      <div class="ff-control__media-preview ff-control__media-preview--image">
        ${previewMarkup('image', work.coverImage || work.poster || work.posterSrc, `${work.title} 封面`)}
        <span>PLACEHOLDER MEDIA</span>
      </div>
      <label><span>路径或网址</span><input type="text" value="${escapeHtml(work.coverImage || work.poster || '')}" placeholder="/media/poster.webp 或 https://…" data-field="cover-src" data-work="${workIndex}"></label>
      <label class="ff-control__file"><span>选择本地图片</span><input type="file" accept="image/*" data-local-kind="image" data-work="${workIndex}"></label>
    </div>

    <div class="ff-control__asset-block">
      <div class="ff-control__asset-title"><strong>音乐</strong><button type="button" data-action="audio-clear" data-work="${workIndex}">删除</button></div>
      <div class="ff-control__media-preview ff-control__media-preview--audio">${previewMarkup('audio', work.audioSrc, `${work.title} 音乐`)}</div>
      <label><span>路径或网址</span><input type="text" value="${escapeHtml(work.audioSrc)}" placeholder="/media/audio.m4a 或 https://…" data-field="audio-src" data-work="${workIndex}"></label>
      <label class="ff-control__file"><span>选择本地音频</span><input type="file" accept="audio/*" data-local-kind="audio" data-work="${workIndex}"></label>
    </div>

    <div class="ff-control__asset-block">
      <div class="ff-control__asset-title ff-control__asset-title--clips"><strong>封面短片 · ${work.clips.length}</strong>${work.clips.length ? `<select data-clip-select>${work.clips.map((clip, index) => `<option value="${index}" ${index === activeClipIndex ? 'selected' : ''}>${String(index + 1).padStart(2, '0')} · ${escapeHtml(clip.title)}</option>`).join('')}</select>` : ''}<button type="button" data-action="clip-add" data-work="${workIndex}">＋ 添加</button></div>
      <div class="ff-control__clips">
        ${work.clips[activeClipIndex] ? clipMarkup(work.clips[activeClipIndex], workIndex, activeClipIndex, work.clips.length) : '<p class="ff-control__empty">尚未添加短片。</p>'}
      </div>
    </div>
  </section>`;

export const mountControlPanel = ({
  root = document.body,
  project,
  onPreview,
  onSave,
  onReset,
  assetStore = createMediaAssetStore(),
} = {}) => {
  if (!root?.append) throw new TypeError('mountControlPanel 需要有效的挂载容器。');

  let saved = sanitizeProject(project);
  let draft = clone(saved);
  let open = readOpenState();
  let activeTab = 'motion';
  let activeWorkIndex = 0;
  let activeClipIndex = 0;
  let status = '调整会立即预览；点击保存后才会长期保留。';
  let statusTone = 'neutral';
  let destroyed = false;
  let renderRevision = 0;
  let saving = false;

  const host = document.createElement('div');
  host.className = 'ff-control';
  host.dataset.open = String(open);
  root.append(host);

  const isDirty = () => !sameProject(draft, saved);
  const safeDraft = () => sanitizeProject(draft);

  const setStatus = (message, tone = 'neutral') => {
    status = message;
    statusTone = tone;
    const output = host.querySelector('[data-control-status]');
    if (output) {
      output.textContent = status;
      output.dataset.tone = tone;
    }
  };

  const updateDirtyUi = () => {
    const dirty = isDirty();
    host.dataset.dirty = String(dirty);
    host.querySelector('[data-unsaved]')?.toggleAttribute('hidden', !dirty);
    const saveButton = host.querySelector('[data-action="save"]');
    if (saveButton) saveButton.disabled = !dirty || saving;
    const undoButton = host.querySelector('[data-action="undo"]');
    if (undoButton) undoButton.disabled = !dirty || saving;
  };

  const emitPreview = () => {
    draft = safeDraft();
    onPreview?.(clone(draft), { assetStore });
    updateDirtyUi();
  };

  const hydratePreviews = async () => {
    const revision = ++renderRevision;
    const previews = [...host.querySelectorAll('[data-preview-ref]')];
    await Promise.all(previews.map(async (element) => {
      const reference = element.dataset.previewRef;
      let source = reference;
      try {
        if (isLocalMediaReference(reference)) source = await assetStore.resolve(reference);
      } catch {
        source = '';
      }
      if (destroyed || revision !== renderRevision || !element.isConnected) return;
      if (!source) {
        element.closest('.ff-control__media-preview')?.classList.add('is-missing');
        element.replaceWith(Object.assign(document.createElement('span'), {
          className: 'ff-control__empty-preview',
          textContent: '本地素材缺失',
        }));
        return;
      }
      element.src = source;
    }));
  };

  const render = () => {
    host.dataset.open = String(open);
    host.innerHTML = `
      <button class="ff-control__toggle" type="button" data-action="toggle" aria-expanded="${open}" aria-controls="flowframe-control-panel" aria-label="${open ? '关闭' : '打开'}动效与媒体控制台">
        <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="4"></circle><path d="M16 3v5M16 24v5M3 16h5M24 16h5M6.8 6.8l3.6 3.6M21.6 21.6l3.6 3.6M25.2 6.8l-3.6 3.6M10.4 21.6l-3.6 3.6"></path></svg>
        <span>CONTROL</span>
        <i data-unsaved ${isDirty() ? '' : 'hidden'}></i>
      </button>
      <aside class="ff-control__panel" id="flowframe-control-panel" aria-hidden="${!open}" aria-label="FLOWFRAME 动效与媒体控制台">
        <header class="ff-control__header">
          <div><span>FLOWFRAME / LIVE CONTROL</span><h2>动效与素材</h2></div>
          <button type="button" data-action="close" aria-label="关闭控制台">×</button>
        </header>
        <nav class="ff-control__tabs" aria-label="控制台页面">
          <button type="button" data-action="tab" data-tab="motion" aria-selected="${activeTab === 'motion'}">MOTION</button>
          <button type="button" data-action="tab" data-tab="media" aria-selected="${activeTab === 'media'}">MEDIA</button>
        </nav>
        <div class="ff-control__scroll" data-control-scroll>
          ${activeTab === 'motion'
            ? `<div class="ff-control__motion">${motionMarkup(draft)}</div>`
            : `<div class="ff-control__media">
                <div class="ff-control__media-intro">
                  <label class="ff-control__work-picker"><span>当前作品</span><select data-work-select>${draft.works.map((work, index) => `<option value="${index}" ${index === activeWorkIndex ? 'selected' : ''}>${String(index + 1).padStart(2, '0')} · ${escapeHtml(work.title)}</option>`).join('')}</select></label>
                  <button type="button" data-action="work-add" ${draft.works.length >= PROJECT_LIMITS.maxWorks ? 'disabled' : ''}>＋ 新增作品</button>
                </div>
                <p class="ff-control__local-note">本地文件保存在当前浏览器；JSON 不包含二进制。</p>
                ${workMarkup(draft.works[activeWorkIndex] || draft.works[0], activeWorkIndex, draft.works.length, activeClipIndex)}
              </div>`}
        </div>
        <footer class="ff-control__footer">
          <p data-control-status data-tone="${statusTone}">${escapeHtml(status)}</p>
          <div class="ff-control__footer-actions">
            <button type="button" data-action="undo" ${isDirty() ? '' : 'disabled'}>撤销未保存</button>
            <button type="button" data-action="reset-all">恢复默认</button>
            <button type="button" data-action="export">导出 JSON</button>
            <button type="button" class="ff-control__save" data-action="save" ${isDirty() ? '' : 'disabled'}>保存</button>
          </div>
        </footer>
      </aside>`;
    updateDirtyUi();
    hydratePreviews();
  };

  const setOpen = (nextOpen) => {
    open = Boolean(nextOpen);
    writeOpenState(open);
    host.dataset.open = String(open);
    const panel = host.querySelector('.ff-control__panel');
    const toggle = host.querySelector('.ff-control__toggle');
    panel?.setAttribute('aria-hidden', String(!open));
    toggle?.setAttribute('aria-expanded', String(open));
    if (open) host.querySelector('.ff-control__panel button, .ff-control__panel input')?.focus({ preventScroll: true });
  };

  const moveItem = (list, index, direction) => {
    const target = index + direction;
    if (!list[index] || target < 0 || target >= list.length) return false;
    [list[index], list[target]] = [list[target], list[index]];
    return true;
  };

  const save = async () => {
    if (saving || !isDirty()) return;
    saving = true;
    updateDirtyUi();
    setStatus('正在保存配置与本地素材…');
    try {
      const requested = safeDraft();
      const result = await onSave?.(clone(requested), { assetStore });
      saved = sanitizeProject(result || requested);
      draft = clone(saved);
      await assetStore.prune(saved);
      setStatus('配置已保存到这个浏览器。', 'success');
      onPreview?.(clone(draft), { assetStore });
      render();
    } catch (error) {
      setStatus(error?.message || '保存失败。请检查浏览器存储空间。', 'error');
      updateDirtyUi();
    } finally {
      saving = false;
      updateDirtyUi();
    }
  };

  const exportJson = () => {
    const blob = new Blob([`${JSON.stringify(safeDraft(), null, 2)}\n`], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `flowframe-project-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus('JSON 已导出；本地图片、视频和音频没有写入文件。', 'success');
  };

  const resetAll = async () => {
    if (!window.confirm('确认恢复默认配置吗？当前草稿和已保存配置都会被替换。')) return;
    saving = true;
    updateDirtyUi();
    setStatus('正在恢复默认配置…');
    try {
      const result = await onReset?.({ assetStore });
      saved = sanitizeProject(result || createDefaultProject());
      draft = clone(saved);
      await assetStore.prune(saved);
      onPreview?.(clone(draft), { assetStore });
      setStatus('已恢复默认配置。', 'success');
      render();
    } catch (error) {
      setStatus(error?.message || '恢复默认配置失败。', 'error');
    } finally {
      saving = false;
      updateDirtyUi();
    }
  };

  const handleClick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !host.contains(button)) return;
    const action = button.dataset.action;
    const workIndex = Number(button.dataset.work);
    const clipIndex = Number(button.dataset.clip);
    const work = draft.works[workIndex];

    if (action === 'toggle') return setOpen(!open);
    if (action === 'close') return setOpen(false);
    if (action === 'tab') {
      activeTab = button.dataset.tab === 'media' ? 'media' : 'motion';
      render();
      return;
    }
    if (action === 'save') return void save();
    if (action === 'reset-all') return void resetAll();
    if (action === 'undo') {
      draft = clone(saved);
      emitPreview();
      setStatus('已撤销全部未保存修改。', 'success');
      render();
      return;
    }
    if (action === 'export') return exportJson();
    if (action === 'reset-group') {
      const group = MOTION_GROUPS.find((item) => item.id === button.dataset.group);
      group?.fields.forEach((field) => { draft.motion[field.key] = DEFAULT_MOTION[field.key]; });
      emitPreview();
      setStatus(`“${group?.label || '动效'}”已恢复默认值。`);
      render();
      return;
    }
    if (action === 'work-add') {
      if (draft.works.length >= PROJECT_LIMITS.maxWorks) return;
      draft.works.push(makeWork(draft.works.length));
      activeWorkIndex = draft.works.length - 1;
      activeClipIndex = 0;
      normalizeOrders(draft);
    } else if (action === 'work-delete' && work && draft.works.length > PROJECT_LIMITS.minWorks) {
      draft.works.splice(workIndex, 1);
      activeWorkIndex = Math.min(activeWorkIndex, draft.works.length - 1);
      activeClipIndex = 0;
      normalizeOrders(draft);
    } else if (action === 'work-up' && moveItem(draft.works, workIndex, -1)) {
      activeWorkIndex = workIndex - 1;
      normalizeOrders(draft);
    } else if (action === 'work-down' && moveItem(draft.works, workIndex, 1)) {
      activeWorkIndex = workIndex + 1;
      normalizeOrders(draft);
    } else if (action === 'cover-clear' && work) {
      work.poster = '';
      work.coverImage = '';
      work.posterSrc = '';
      work.detailStill = '';
      work.posterStatus = ASSET_STATUS.missing;
      work.coverStatus = ASSET_STATUS.missing;
    } else if (action === 'audio-clear' && work) {
      work.audioSrc = '';
      work.audioStatus = ASSET_STATUS.missing;
    } else if (action === 'clip-add' && work) {
      work.clips.push(makeClip(workIndex, work.clips.length));
      activeClipIndex = work.clips.length - 1;
      syncPrimaryClip(work);
    } else if (action === 'clip-delete' && work?.clips?.[clipIndex]) {
      work.clips.splice(clipIndex, 1);
      activeClipIndex = Math.min(activeClipIndex, Math.max(0, work.clips.length - 1));
      syncPrimaryClip(work);
    } else if (action === 'clip-up' && moveItem(work?.clips || [], clipIndex, -1)) {
      activeClipIndex = clipIndex - 1;
      syncPrimaryClip(work);
    } else if (action === 'clip-down' && moveItem(work?.clips || [], clipIndex, 1)) {
      activeClipIndex = clipIndex + 1;
      syncPrimaryClip(work);
    } else {
      return;
    }
    emitPreview();
    render();
  };

  const handleInput = (event) => {
    const motionKey = event.target.dataset.motionRange || event.target.dataset.motionNumber;
    if (motionKey) {
      const field = MOTION_GROUPS.flatMap((group) => group.fields).find((item) => item.key === motionKey);
      if (!field) return;
      const numeric = Number(event.target.value);
      if (!Number.isFinite(numeric)) return;
      const value = Math.min(field.max, Math.max(field.min, numeric));
      draft.motion[motionKey] = value;
      host.querySelector(`[data-motion-range="${motionKey}"]`).value = value;
      host.querySelector(`[data-motion-number="${motionKey}"]`).value = formatValue(field, value);
      emitPreview();
      return;
    }

    const field = event.target.dataset.field;
    const workIndex = Number(event.target.dataset.work);
    const clipIndex = Number(event.target.dataset.clip);
    const work = draft.works[workIndex];
    if (!field || !work) return;
    if (field === 'work-title') work.title = event.target.value;
    if (field === 'work-title-en') work.titleEn = event.target.value;
    if (field === 'cover-src') {
      work.poster = event.target.value;
      work.coverImage = event.target.value;
      work.posterSrc = event.target.value;
      work.detailStill = event.target.value;
      work.posterStatus = event.target.value ? ASSET_STATUS.placeholder : ASSET_STATUS.missing;
      work.coverStatus = work.posterStatus;
    }
    if (field === 'audio-src') {
      work.audioSrc = event.target.value;
      work.audioStatus = event.target.value ? ASSET_STATUS.placeholder : ASSET_STATUS.missing;
    }
    if (field === 'clip-title' && work.clips[clipIndex]) work.clips[clipIndex].title = event.target.value;
    if (field === 'clip-src' && work.clips[clipIndex]) {
      work.clips[clipIndex].src = event.target.value;
      work.clips[clipIndex].status = event.target.value ? ASSET_STATUS.placeholder : ASSET_STATUS.missing;
      syncPrimaryClip(work);
    }
    emitPreview();
  };

  const handleChange = async (event) => {
    if (event.target.matches('[data-work-select]')) {
      activeWorkIndex = Math.min(draft.works.length - 1, Math.max(0, Number(event.target.value) || 0));
      activeClipIndex = 0;
      render();
      return;
    }
    if (event.target.matches('[data-clip-select]')) {
      const clipCount = draft.works[activeWorkIndex]?.clips?.length || 0;
      activeClipIndex = Math.min(Math.max(0, clipCount - 1), Math.max(0, Number(event.target.value) || 0));
      render();
      return;
    }
    const kind = event.target.dataset.localKind;
    if (!kind) {
      if (['cover-src', 'audio-src', 'clip-src'].includes(event.target.dataset.field)) render();
      return;
    }
    const file = event.target.files?.[0];
    const workIndex = Number(event.target.dataset.work);
    const clipIndex = Number(event.target.dataset.clip);
    const work = draft.works[workIndex];
    if (!file || !work) return;
    event.target.disabled = true;
    setStatus(`正在保存“${file.name}”…`);
    try {
      const source = await assetStore.putFile(file, kind);
      if (kind === 'image') {
        work.poster = source;
        work.coverImage = source;
        work.posterSrc = source;
        work.detailStill = source;
        work.posterStatus = ASSET_STATUS.placeholder;
        work.coverStatus = ASSET_STATUS.placeholder;
      } else if (kind === 'audio') {
        work.audioSrc = source;
        work.audioStatus = ASSET_STATUS.placeholder;
      } else if (work.clips[clipIndex]) {
        work.clips[clipIndex].src = source;
        work.clips[clipIndex].status = ASSET_STATUS.placeholder;
        syncPrimaryClip(work);
      }
      emitPreview();
      setStatus(`“${file.name}”已保存为本地 PLACEHOLDER MEDIA。点击保存以写入项目配置。`, 'success');
      render();
    } catch (error) {
      event.target.disabled = false;
      setStatus(`“${file.name}”保存失败：${error?.message || '浏览器存储空间不足。'}`, 'error');
    }
  };

  const handleWheel = (event) => {
    if (event.target.closest('[data-control-scroll]')) event.stopPropagation();
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      host.querySelector('[data-action="toggle"]')?.focus({ preventScroll: true });
      return;
    }
    if (open && host.contains(event.target)) event.stopPropagation();
  };

  const handleBeforeUnload = (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  };

  host.addEventListener('click', handleClick);
  host.addEventListener('input', handleInput);
  host.addEventListener('change', handleChange);
  host.addEventListener('wheel', handleWheel, { passive: true });
  window.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('beforeunload', handleBeforeUnload);
  render();

  const updateProject = (nextProject, { asSaved = true, force = false } = {}) => {
    if (isDirty() && !force) return false;
    const next = sanitizeProject(nextProject);
    if (asSaved) saved = clone(next);
    draft = clone(next);
    activeWorkIndex = Math.min(activeWorkIndex, Math.max(0, draft.works.length - 1));
    activeClipIndex = Math.min(activeClipIndex, Math.max(0, (draft.works[activeWorkIndex]?.clips?.length || 1) - 1));
    onPreview?.(clone(draft), { assetStore });
    render();
    return true;
  };

  return {
    element: host,
    assetStore,
    getDraft: () => clone(safeDraft()),
    getSaved: () => clone(saved),
    isDirty,
    isOpen: () => open,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    save,
    reset: resetAll,
    updateProject,
    setProject: updateProject,
    markSaved(nextProject = draft) {
      saved = sanitizeProject(nextProject);
      draft = clone(saved);
      updateDirtyUi();
      return clone(saved);
    },
    destroy() {
      destroyed = true;
      renderRevision += 1;
      host.removeEventListener('click', handleClick);
      host.removeEventListener('input', handleInput);
      host.removeEventListener('change', handleChange);
      host.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeydown, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      host.remove();
    },
  };
};

export default mountControlPanel;
