const DATABASE_NAME = 'flowframe-media-v1';
const STORE_NAME = 'assets';
const DATABASE_VERSION = 1;
const REFERENCE_PREFIX = 'idb://flowframe/';

const requestResult = (request) => new Promise((resolve, reject) => {
  request.addEventListener('success', () => resolve(request.result), { once: true });
  request.addEventListener('error', () => reject(request.error || new Error('IndexedDB 操作失败。')), { once: true });
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.addEventListener('complete', resolve, { once: true });
  transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB 事务已中止。')), { once: true });
  transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB 事务失败。')), { once: true });
});

const makeId = () => globalThis.crypto?.randomUUID?.()
  || `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const isLocalMediaReference = (value) => String(value || '').startsWith(REFERENCE_PREFIX);

export const mediaReferenceToId = (value) => isLocalMediaReference(value)
  ? decodeURIComponent(String(value).slice(REFERENCE_PREFIX.length))
  : '';

export const mediaIdToReference = (id) => `${REFERENCE_PREFIX}${encodeURIComponent(String(id))}`;

const collectReferences = (value, output = new Set()) => {
  if (typeof value === 'string') {
    const id = mediaReferenceToId(value);
    if (id) output.add(id);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferences(item, output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectReferences(item, output));
  }
  return output;
};

const replaceReferences = async (value, resolver) => {
  if (typeof value === 'string') return isLocalMediaReference(value) ? resolver(value) : value;
  if (Array.isArray(value)) return Promise.all(value.map((item) => replaceReferences(item, resolver)));
  if (!value || typeof value !== 'object') return value;
  const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [
    key,
    await replaceReferences(item, resolver),
  ]));
  return Object.fromEntries(entries);
};

export const createMediaAssetStore = ({ indexedDB = globalThis.indexedDB } = {}) => {
  let databasePromise = null;
  const objectUrls = new Map();

  const openDatabase = () => {
    if (!indexedDB) return Promise.reject(new Error('当前浏览器不支持 IndexedDB，无法保存本地媒体。'));
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('kind', 'kind', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      });
      request.addEventListener('success', () => {
        const database = request.result;
        database.addEventListener('versionchange', () => database.close());
        resolve(database);
      }, { once: true });
      request.addEventListener('error', () => {
        databasePromise = null;
        reject(request.error || new Error('无法打开本地媒体数据库。'));
      }, { once: true });
      request.addEventListener('blocked', () => {
        databasePromise = null;
        reject(new Error('本地媒体数据库正在被另一个页面占用。请关闭旧页面后重试。'));
      }, { once: true });
    });
    return databasePromise;
  };

  const transaction = async (mode, callback) => {
    const database = await openDatabase();
    const tx = database.transaction(STORE_NAME, mode);
    const result = await callback(tx.objectStore(STORE_NAME));
    await transactionDone(tx);
    return result;
  };

  const putFile = async (file, kind) => {
    if (!(file instanceof Blob)) throw new TypeError('本地素材必须是 File 或 Blob。');
    if (!['image', 'video', 'audio'].includes(kind)) throw new TypeError('素材类型必须是 image、video 或 audio。');
    const id = makeId();
    const record = {
      id,
      kind,
      name: String(file.name || `${kind}-${id}`),
      mimeType: String(file.type || 'application/octet-stream'),
      size: Number(file.size || 0),
      blob: file,
      createdAt: new Date().toISOString(),
    };
    await transaction('readwrite', (store) => requestResult(store.add(record)));
    return mediaIdToReference(id);
  };

  const get = async (referenceOrId) => {
    const id = mediaReferenceToId(referenceOrId) || String(referenceOrId || '');
    if (!id) return null;
    return transaction('readonly', (store) => requestResult(store.get(id)));
  };

  const list = () => transaction('readonly', (store) => requestResult(store.getAll()));

  const has = async (referenceOrId) => Boolean(await get(referenceOrId));

  const describe = async (referenceOrId) => {
    const record = await get(referenceOrId);
    if (!record) return null;
    const { blob, ...description } = record;
    return {
      ...description,
      reference: mediaIdToReference(record.id),
    };
  };

  const release = (referenceOrId) => {
    const id = mediaReferenceToId(referenceOrId) || String(referenceOrId || '');
    const url = objectUrls.get(id);
    if (!url) return false;
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
    return true;
  };

  const remove = async (referenceOrId) => {
    const id = mediaReferenceToId(referenceOrId) || String(referenceOrId || '');
    if (!id) return false;
    release(id);
    await transaction('readwrite', (store) => requestResult(store.delete(id)));
    return true;
  };

  const resolve = async (value) => {
    if (!isLocalMediaReference(value)) return String(value || '');
    const id = mediaReferenceToId(value);
    if (objectUrls.has(id)) return objectUrls.get(id);
    const record = await get(id);
    if (!record?.blob) return '';
    const url = URL.createObjectURL(record.blob);
    objectUrls.set(id, url);
    return url;
  };

  const resolveProject = (project) => replaceReferences(project, resolve);

  const prune = async (keepRefs) => {
    const retained = keepRefs instanceof Set
      ? new Set([...keepRefs].map((value) => mediaReferenceToId(value) || String(value)))
      : collectReferences(keepRefs);
    const records = await list();
    const removed = [];
    for (const record of records) {
      if (retained.has(record.id)) continue;
      await remove(record.id);
      removed.push(record.id);
    }
    return removed;
  };

  const releaseAll = () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  };

  const close = async () => {
    releaseAll();
    const database = await databasePromise?.catch(() => null);
    database?.close();
    databasePromise = null;
  };

  return {
    databaseName: DATABASE_NAME,
    storeName: STORE_NAME,
    referencePrefix: REFERENCE_PREFIX,
    putFile,
    get,
    describe,
    has,
    list,
    remove,
    resolve,
    resolveProject,
    collectReferences,
    prune,
    release,
    releaseAll,
    close,
    destroy: close,
  };
};

export default createMediaAssetStore;
