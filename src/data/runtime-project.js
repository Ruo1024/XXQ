import { sanitizeProject } from './project-contract.js';
import { resolvePublicAssetUrl } from './public-asset-url.js';

const clone = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const WORK_MEDIA_KEYS = Object.freeze([
  'poster',
  'coverImage',
  'posterSrc',
  'detailStill',
  'audioSrc',
  'videoSrc',
]);

export const isLocalAssetReference = (value) => /^idb:\/\/flowframe\/[a-z0-9-]+$/i.test(String(value || ''));

export const collectLocalAssetReferences = (project) => {
  const references = new Set();
  const collect = (value) => {
    if (isLocalAssetReference(value)) references.add(String(value));
  };

  project?.works?.forEach((work) => {
    WORK_MEDIA_KEYS.forEach((key) => collect(work?.[key]));
    work?.clips?.forEach((clip) => {
      collect(clip?.src);
      collect(clip?.poster);
    });
  });
  return references;
};

export const hydrateProjectAssets = async (project, assetStore) => {
  const canonical = sanitizeProject(project);
  const runtime = clone(canonical);
  const jobs = [];
  const resolveField = (target, key) => {
    if (!target) return;
    if (!isLocalAssetReference(target[key])) {
      target[key] = resolvePublicAssetUrl(target[key]);
      return;
    }
    if (!assetStore?.resolve) return;
    const reference = target[key];
    jobs.push(Promise.resolve(assetStore.resolve(reference)).then((resolved) => {
      target[key] = String(resolved || '');
    }).catch(() => {
      target[key] = '';
    }));
  };

  runtime.works.forEach((work) => {
    WORK_MEDIA_KEYS.forEach((key) => resolveField(work, key));
    work.clips.forEach((clip) => {
      resolveField(clip, 'src');
      resolveField(clip, 'poster');
    });
  });

  await Promise.all(jobs);
  return sanitizeProject(runtime);
};
