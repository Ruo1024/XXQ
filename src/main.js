import './app-shell.css';
import { createDefaultProject, PROJECT_LIMITS, sanitizeProject } from './data/project-contract.js';
import { loadProject, resetProject, saveProject } from './data/project-store.js';
import { createMediaAssetStore } from './data/media-asset-store.js';
import { collectLocalAssetReferences, hydrateProjectAssets } from './data/runtime-project.js';
import { mountHome } from './home/home-experience.js';
import { mountTransition } from './detail/transition-experience.js';
import { mountWorkDetail } from './detail/work-detail-experience.js';
import { mountStudio } from './studio/studio.js';
import { mountControlPanel } from './control/control-panel.js';
import { backgroundAudio } from './audio/background-audio.js';

const root = document.querySelector('#app');
const controlRoot = document.querySelector('#flowframeControlRoot');
const desktopGuard = document.querySelector('#desktopGuard');
// Studio 是第一检查点保留的正式原型路由；只有显式设为 0 时才关闭。
const studioEnabled = import.meta.env.VITE_ENABLE_STUDIO !== '0';

const assetStore = createMediaAssetStore();
let project = sanitizeProject(loadProject?.() || createDefaultProject());
let runtimeProject = await hydrateProjectAssets(project, assetStore);
let mountedExperience = null;
let mountedRouteName = '';
let routeToken = 0;
let projectRevision = 0;
let controlPanel = null;

const navigate = (path) => {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === target) {
    renderRoute();
    return;
  }
  window.location.hash = target;
};

const parseRoute = () => {
  const hash = window.location.hash || '#/';
  if (hash === '#/studio') return { name: 'studio' };
  if (hash === '#/lab/transition') return { name: 'transition' };

  const workMatch = hash.match(/^#\/works\/([^/?#]+)$/);
  if (workMatch) {
    let workId = null;
    try {
      workId = decodeURIComponent(workMatch[1]);
    } catch {
      // Invalid percent encoding is normalized to the first available work below.
    }
    return {
      name: 'detail',
      workId,
    };
  }

  return { name: 'home', normalizeHash: hash !== '#/' };
};

const syncWorkHash = (workId, { replace = false } = {}) => {
  const target = `#/works/${encodeURIComponent(workId)}`;
  if (window.location.hash === target) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', target);
};

const clearMountedExperience = () => {
  mountedExperience?.destroy?.();
  mountedExperience = null;
  mountedRouteName = '';
  root.replaceChildren();
  document.body.dataset.route = '';
};

const applyProjectPreview = async (nextProject) => {
  const safeProject = sanitizeProject(nextProject);
  const revision = ++projectRevision;
  project = safeProject;
  const hydrated = await hydrateProjectAssets(safeProject, assetStore);
  if (revision !== projectRevision) return safeProject;
  runtimeProject = hydrated;

  if (mountedRouteName === 'detail') {
    const route = parseRoute();
    if (!project.works.some((work) => work.id === route.workId) && project.works[0]) {
      syncWorkHash(project.works[0].id, { replace: true });
    }
  }

  if (mountedRouteName && mountedRouteName !== 'studio') {
    mountedExperience?.updateProject?.(runtimeProject);
  }
  return safeProject;
};

const markStudioProject = (nextProject, { saved = false } = {}) => {
  const safeProject = sanitizeProject(nextProject);
  if (controlPanel) {
    controlPanel.updateProject(safeProject, { asSaved: saved, force: true });
  } else {
    void applyProjectPreview(safeProject);
  }
  if (saved) void assetStore.prune(collectLocalAssetReferences(safeProject));
};

const showRouteError = (error) => {
  console.error(error);
  const panel = document.createElement('main');
  panel.className = 'route-error';
  panel.innerHTML = `
    <p>FLOWFRAME / ERROR</p>
    <h1>这个页面暂时没有正常打开</h1>
    <span>刷新页面；如果问题仍在，请回到首页。</span>
    <button type="button">返回首页</button>
  `;
  panel.querySelector('button').addEventListener('click', () => navigate('#/'));
  root.replaceChildren(panel);
};

const renderRoute = () => {
  const route = parseRoute();
  if (route.normalizeHash) window.history.replaceState(null, '', '#/');

  if (route.name === 'detail') {
    const workExists = project.works.some((work) => work.id === route.workId);
    const workId = workExists ? route.workId : project.works[0]?.id;
    if (workId && workId !== route.workId) syncWorkHash(workId, { replace: true });
    if (mountedRouteName === 'detail' && mountedExperience?.navigateToWork) {
      mountedExperience.navigateToWork(workId, { fromHash: true });
      return;
    }
    route.workId = workId;
  }

  const token = ++routeToken;
  clearMountedExperience();
  document.body.dataset.route = route.name;
  mountedRouteName = route.name;

  try {
    if (route.name === 'studio') {
      if (!studioEnabled) {
        navigate('#/');
        return;
      }

      mountedExperience = mountStudio({
        root,
        project,
        onProjectChange(nextProject) {
          if (token !== routeToken) return;
          markStudioProject(nextProject);
        },
        onProjectSave: (nextProject) => markStudioProject(nextProject, { saved: true }),
        onProjectReset: (nextProject) => markStudioProject(nextProject, { saved: true }),
        onBack: () => navigate('#/'),
      });
      return;
    }

    if (route.name === 'transition') {
      mountedExperience = mountTransition({
        root,
        project: runtimeProject,
        workId: 'afterglow',
        labMode: true,
        onBack: () => navigate('#/'),
      });
      return;
    }

    if (route.name === 'detail') {
      mountedExperience = mountWorkDetail({
        root,
        project: runtimeProject,
        workId: route.workId,
        onBack: () => navigate('#/'),
        onWorkIdChange: syncWorkHash,
        audioController: backgroundAudio,
      });
      return;
    }

    mountedExperience = mountHome({
      root,
      project: runtimeProject,
      onOpenWork: (workId) => navigate(`#/works/${encodeURIComponent(workId)}`),
      onOpenStudio: studioEnabled ? () => navigate('#/studio') : null,
      audioController: backgroundAudio,
    });
  } catch (error) {
    showRouteError(error);
  }
};

const updateDesktopGuard = () => {
  const narrow = window.innerWidth < PROJECT_LIMITS.desktopMinWidth;
  desktopGuard.setAttribute('aria-hidden', String(!narrow));
  document.body.classList.toggle('is-desktop-too-narrow', narrow);
};

window.addEventListener('hashchange', renderRoute);
window.addEventListener('resize', updateDesktopGuard, { passive: true });
window.addEventListener('flowframe:project-change', (event) => {
  const saved = saveProject(sanitizeProject(event.detail));
  controlPanel?.updateProject(saved, { asSaved: true, force: true });
});

controlPanel = mountControlPanel({
  root: controlRoot,
  project,
  assetStore,
  onPreview: (nextProject) => applyProjectPreview(nextProject),
  async onSave(nextProject) {
    const saved = saveProject(sanitizeProject(nextProject));
    await applyProjectPreview(saved);
    return saved;
  },
  async onReset() {
    const reset = resetProject();
    await applyProjectPreview(reset);
    return reset;
  },
});

window.flowframeRuntime = Object.freeze({
  getProject: () => sanitizeProject(project),
  getRuntimeProject: () => sanitizeProject(runtimeProject),
  getMountedExperience: () => mountedExperience,
  getControlPanel: () => controlPanel,
  getAssetStore: () => assetStore,
});

window.addEventListener('pagehide', () => {
  assetStore.releaseAll();
}, { once: true });

updateDesktopGuard();
renderRoute();
