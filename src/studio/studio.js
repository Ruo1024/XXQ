import {
  ASSET_STATUS,
  DEFAULT_WORKS,
  PROJECT_LIMITS,
  createDefaultProject,
  sanitizeProject,
} from '../data/project-contract.js';
import {
  downloadProject,
  loadProject,
  parseImportedProject,
  resetProject,
  saveProject,
} from '../data/project-store.js';
import { MOTION_FIELDS } from '../data/motion-schema.js';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  createIcons,
} from 'lucide';
import './studio.css';

const STUDIO_ICONS = {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const makeWork = (index) => {
  const source = clone(DEFAULT_WORKS[index % DEFAULT_WORKS.length]);
  const sequence = index + 1;
  return {
    ...source,
    id: `${source.id}-${Date.now().toString(36).slice(-4)}`,
    order: sequence,
    index: String(sequence).padStart(2, '0'),
    title: `新作品 ${String(sequence).padStart(2, '0')}`,
    titleEn: `NEW WORK ${String(sequence).padStart(2, '0')}`,
    videoSrc: '',
    videoStatus: ASSET_STATUS.missing,
    clips: [],
  };
};

const makeClip = (workIndex, clipIndex) => ({
  id: `clip-${Date.now().toString(36)}-${workIndex + 1}-${clipIndex + 1}`,
  title: `CLIP ${String(clipIndex + 1).padStart(2, '0')}`,
  src: '',
  poster: '',
  tone: '#b8b8b8',
  status: ASSET_STATUS.missing,
  note: '等待替换为已获授权的正式视频。',
});

const normalizeOrders = (project) => {
  project.works.forEach((work, index) => {
    work.order = index + 1;
    work.index = String(index + 1).padStart(2, '0');
  });
};

const syncPrimaryMedia = (work) => {
  const primaryClip = work?.clips?.find((clip) => clip.src) || work?.clips?.[0];
  if (!work) return;
  work.videoSrc = primaryClip?.src || '';
  work.videoStatus = primaryClip?.status || ASSET_STATUS.missing;
};

export const mountStudio = ({
  root,
  project,
  onProjectChange,
  onProjectSave,
  onProjectReset,
  onBack,
} = {}) => {
  if (!root) throw new Error('mountStudio 需要 root 容器。');

  let current = sanitizeProject(project || loadProject());
  const sessionPreviews = new Map();
  let notice = '所有修改先在本页预览。点击“保存到浏览器”后才会长期保留。';
  let noticeTone = 'neutral';

  const revokeSessionPreviews = () => {
    sessionPreviews.forEach((url) => URL.revokeObjectURL(url));
    sessionPreviews.clear();
  };

  const emit = () => {
    current = sanitizeProject(current);
    onProjectChange?.(current);
  };

  const setNotice = (message, tone = 'neutral') => {
    notice = message;
    noticeTone = tone;
  };

  const motionMarkup = () =>
    MOTION_FIELDS.map((field) => {
      const value = Number(current.motion[field.key]);
      return `
        <label class="studio-control">
          <span class="studio-control__head">
            <span>${field.label}</span>
            <output data-motion-output="${field.key}">${Number.isFinite(value) ? value : field.min}</output>
          </span>
          <input
            type="range"
            min="${field.min}"
            max="${field.max}"
            step="${field.step}"
            value="${Number.isFinite(value) ? value : field.min}"
            data-motion="${field.key}"
          >
        </label>`;
    }).join('');

  const clipMarkup = (clip, workIndex, clipIndex) => {
    const previewSrc = sessionPreviews.get(clip.id) || clip.src;
    const isSessionFile = sessionPreviews.has(clip.id);
    const media = previewSrc
      ? `<video class="studio-clip__video" src="${escapeHtml(previewSrc)}" muted loop playsinline controls preload="metadata"></video>`
      : `<div class="studio-clip__empty">尚未填写视频地址</div>`;

    return `
      <article class="studio-clip" data-clip-id="${escapeHtml(clip.id)}">
        <div class="studio-clip__preview">
          ${media}
          <span class="studio-placeholder-stamp">PLACEHOLDER MEDIA</span>
        </div>
        <div class="studio-clip__form">
          <div class="studio-clip__topline">
            <strong>${String(clipIndex + 1).padStart(2, '0')} · ${escapeHtml(clip.title)}</strong>
            <div class="studio-inline-actions" aria-label="片段排序和删除">
              <button type="button" class="studio-icon-button" data-action="clip-up" data-work="${workIndex}" data-clip="${clipIndex}" ${clipIndex === 0 ? 'disabled' : ''} aria-label="向上移动"><i data-lucide="chevron-up"></i></button>
              <button type="button" class="studio-icon-button" data-action="clip-down" data-work="${workIndex}" data-clip="${clipIndex}" ${clipIndex === current.works[workIndex].clips.length - 1 ? 'disabled' : ''} aria-label="向下移动"><i data-lucide="chevron-down"></i></button>
              <button type="button" class="studio-icon-button studio-icon-button--danger" data-action="clip-delete" data-work="${workIndex}" data-clip="${clipIndex}" aria-label="删除片段"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
          <label class="studio-field">
            <span>片段名称</span>
            <input type="text" value="${escapeHtml(clip.title)}" data-field="clip-title" data-work="${workIndex}" data-clip="${clipIndex}">
          </label>
          <label class="studio-field">
            <span>项目路径或视频网址</span>
            <input type="text" value="${escapeHtml(clip.src)}" placeholder="/media/clip.mp4 或 https://…" data-field="clip-src" data-work="${workIndex}" data-clip="${clipIndex}">
          </label>
          <label class="studio-file-button">
            <span>${isSessionFile ? '已选择本次会话文件' : '选择本地文件临时预览'}</span>
            <input type="file" accept="video/*" data-local-preview data-work="${workIndex}" data-clip="${clipIndex}">
          </label>
          <p class="studio-help">本地文件不会上传，也不会写入保存的配置；关闭页面后需要重新选择。</p>
        </div>
      </article>`;
  };

  const workMarkup = (work, workIndex) => `
    <section class="studio-work">
      <header class="studio-work__header">
        <div>
          <span class="studio-kicker">WORK ${String(workIndex + 1).padStart(2, '0')}</span>
          <h3>${escapeHtml(work.title)} <small>${escapeHtml(work.titleEn)}</small></h3>
        </div>
        <span class="studio-status">${escapeHtml(work.posterStatus || 'missing')}</span>
      </header>
      <div class="studio-work__fields">
        <label class="studio-field">
          <span>中文标题</span>
          <input type="text" value="${escapeHtml(work.title)}" data-field="work-title" data-work="${workIndex}">
        </label>
        <label class="studio-field">
          <span>英文标题</span>
          <input type="text" value="${escapeHtml(work.titleEn)}" data-field="work-title-en" data-work="${workIndex}">
        </label>
      </div>
      <div class="studio-work__clips">
        ${work.clips.map((clip, clipIndex) => clipMarkup(clip, workIndex, clipIndex)).join('') || '<p class="studio-empty-row">这个作品还没有片段。</p>'}
      </div>
      <button type="button" class="studio-add-button" data-action="clip-add" data-work="${workIndex}"><i data-lucide="plus"></i><span>添加片段</span></button>
    </section>`;

  const render = () => {
    root.innerHTML = `
      <main class="studio-shell">
        <header class="studio-header">
          <button type="button" class="studio-back" data-action="back"><i data-lucide="arrow-left"></i><span>返回作品集</span></button>
          <div class="studio-header__title">
            <span class="studio-kicker">DEVELOPMENT CONTROL ROOM</span>
            <h1>动效调节台</h1>
            <p>这是开发工具。它帮助你调节作品数量、视频片段和动效强度。</p>
          </div>
          <div class="studio-placeholder-flag">
            <strong>PLACEHOLDER MEDIA</strong>
            <span>当前海报和视频仅用于测试</span>
          </div>
        </header>

        <section class="studio-toolbar" aria-label="项目配置操作">
          <label class="studio-work-count">
            <span>作品数量</span>
            <input type="number" min="${PROJECT_LIMITS.minWorks}" max="${PROJECT_LIMITS.maxWorks}" value="${current.works.length}" data-work-count>
            <small>最多 6 个</small>
          </label>
          <div class="studio-toolbar__actions">
            <button type="button" data-action="save"><i data-lucide="save"></i><span>保存到浏览器</span></button>
            <button type="button" data-action="export"><i data-lucide="download"></i><span>导出 JSON</span></button>
            <label class="studio-import-button"><i data-lucide="upload"></i><span>导入 JSON</span><input type="file" accept="application/json,.json" data-import></label>
            <button type="button" class="studio-button--quiet" data-action="reset"><i data-lucide="rotate-ccw"></i><span>恢复默认</span></button>
          </div>
        </section>

        <p class="studio-notice studio-notice--${noticeTone}" role="status">${escapeHtml(notice)}</p>

        <div class="studio-grid">
          <aside class="studio-motion">
            <div class="studio-section-title">
              <span class="studio-kicker">MOTION</span>
              <h2>动效参数</h2>
              <p>拖动滑块后，主页面和转场试验页会立即使用新数值。</p>
            </div>
            <div class="studio-motion__controls">${motionMarkup()}</div>
          </aside>

          <div class="studio-works">
            <div class="studio-section-title">
              <span class="studio-kicker">CONTENT</span>
              <h2>作品与片段</h2>
              <p>片段数量不限。页面只会提前准备当前片段和下一个片段。</p>
            </div>
            ${current.works.map(workMarkup).join('')}
          </div>
        </div>
      </main>`;

    createIcons({
      icons: STUDIO_ICONS,
      root,
      attrs: { 'stroke-width': 1.5 },
    });
  };

  const moveClip = (workIndex, clipIndex, direction) => {
    const clips = current.works[workIndex]?.clips;
    const target = clipIndex + direction;
    if (!clips || target < 0 || target >= clips.length) return;
    [clips[clipIndex], clips[target]] = [clips[target], clips[clipIndex]];
    syncPrimaryMedia(current.works[workIndex]);
    emit();
    render();
  };

  const applyWorkCount = (rawValue) => {
    const requested = Math.round(Number(rawValue));
    const nextCount = Math.max(PROJECT_LIMITS.minWorks, Math.min(PROJECT_LIMITS.maxWorks, requested || 1));
    while (current.works.length < nextCount) current.works.push(makeWork(current.works.length));
    if (current.works.length > nextCount) {
      current.works.slice(nextCount).forEach((work) => {
        work.clips.forEach((clip) => {
          const preview = sessionPreviews.get(clip.id);
          if (preview) URL.revokeObjectURL(preview);
          sessionPreviews.delete(clip.id);
        });
      });
      current.works.splice(nextCount);
    }
    normalizeOrders(current);
    emit();
    setNotice(`作品数量已改为 ${nextCount}。`);
    render();
  };

  const handleClick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const workIndex = Number(button.dataset.work);
    const clipIndex = Number(button.dataset.clip);

    if (action === 'back') {
      onBack?.();
      return;
    }
    if (action === 'save') {
      current = saveProject(current);
      onProjectChange?.(current);
      onProjectSave?.(current);
      setNotice('配置已保存到这个浏览器。', 'success');
      render();
      return;
    }
    if (action === 'export') {
      downloadProject(current);
      setNotice('JSON 配置已导出。视频文件不会包含在配置中。', 'success');
      render();
      return;
    }
    if (action === 'reset') {
      const shouldReset = window.confirm('确认恢复默认配置吗？已保存的本地修改会被清除。');
      if (!shouldReset) return;
      revokeSessionPreviews();
      current = resetProject();
      onProjectChange?.(current);
      onProjectReset?.(current);
      setNotice('已恢复默认配置。', 'success');
      render();
      return;
    }
    if (action === 'clip-add') {
      const clips = current.works[workIndex]?.clips;
      if (!clips) return;
      clips.push(makeClip(workIndex, clips.length));
      syncPrimaryMedia(current.works[workIndex]);
      emit();
      setNotice('已添加一个空片段。请填写正式路径，或选择本地文件临时预览。');
      render();
      return;
    }
    if (action === 'clip-delete') {
      const clips = current.works[workIndex]?.clips;
      if (!clips?.[clipIndex]) return;
      const removed = clips.splice(clipIndex, 1)[0];
      const preview = sessionPreviews.get(removed.id);
      if (preview) URL.revokeObjectURL(preview);
      sessionPreviews.delete(removed.id);
      syncPrimaryMedia(current.works[workIndex]);
      emit();
      setNotice('片段已删除。');
      render();
      return;
    }
    if (action === 'clip-up') moveClip(workIndex, clipIndex, -1);
    if (action === 'clip-down') moveClip(workIndex, clipIndex, 1);
  };

  const handleInput = (event) => {
    const motionKey = event.target.dataset.motion;
    if (motionKey) {
      current.motion[motionKey] = Number(event.target.value);
      root.querySelector(`[data-motion-output="${motionKey}"]`).textContent = event.target.value;
      emit();
      return;
    }

    const field = event.target.dataset.field;
    const workIndex = Number(event.target.dataset.work);
    const clipIndex = Number(event.target.dataset.clip);
    const work = current.works[workIndex];
    if (!field || !work) return;

    if (field === 'work-title') work.title = event.target.value;
    if (field === 'work-title-en') work.titleEn = event.target.value;
    if (field === 'clip-title' && work.clips[clipIndex]) work.clips[clipIndex].title = event.target.value;
    if (field === 'clip-src' && work.clips[clipIndex]) {
      work.clips[clipIndex].src = event.target.value;
      work.clips[clipIndex].status = event.target.value
        ? ASSET_STATUS.placeholder
        : ASSET_STATUS.missing;
      syncPrimaryMedia(work);
    }
    emit();
  };

  const handleChange = async (event) => {
    if (event.target.matches('[data-work-count]')) {
      applyWorkCount(event.target.value);
      return;
    }

    if (event.target.matches('[data-local-preview]')) {
      const file = event.target.files?.[0];
      const workIndex = Number(event.target.dataset.work);
      const clipIndex = Number(event.target.dataset.clip);
      const clip = current.works[workIndex]?.clips[clipIndex];
      if (!file || !clip) return;
      const oldUrl = sessionPreviews.get(clip.id);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      sessionPreviews.set(clip.id, URL.createObjectURL(file));
      setNotice(`“${file.name}”只用于本次会话预览，不会上传或保存。`, 'success');
      render();
      return;
    }

    if (event.target.matches('[data-import]')) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        current = parseImportedProject(await file.text());
        onProjectChange?.(current);
        setNotice(`已导入“${file.name}”。请确认内容后再保存。`, 'success');
      } catch (error) {
        setNotice(error.message || '导入失败。', 'error');
      }
      render();
    }
  };

  root.addEventListener('click', handleClick);
  root.addEventListener('input', handleInput);
  root.addEventListener('change', handleChange);
  render();

  return {
    getProject: () => sanitizeProject(current),
    destroy: () => {
      revokeSessionPreviews();
      root.removeEventListener('click', handleClick);
      root.removeEventListener('input', handleInput);
      root.removeEventListener('change', handleChange);
      root.innerHTML = '';
    },
  };
};

export { loadProject, saveProject, resetProject, downloadProject, parseImportedProject };
