import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';
import { MOTION_FIELDS } from '../src/data/motion-schema.js';

const targetUrl = process.env.TARGET_URL || 'http://127.0.0.1:5173/';
const targetBasePath = new URL(targetUrl).pathname.replace(/\/$/, '');
const publicAssetPath = (path) => `${targetBasePath}${path}`;
const verifyScope = process.env.VERIFY_SCOPE || 'all';
const shouldVerify = (scope) => verifyScope === 'all' || verifyScope.split(',').includes(scope);
const currentDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(currentDir, '../output/qa');
const REFERENCE_VIEWPORT = { width: 1586, height: 992 };
const DETAIL_REFERENCE_VIEWPORT = { width: 1440, height: 900 };
const EXPECTED_MOTION_COUNT = 36;
const NEW_MOTION_KEYS = [
  'homePosterSwitchKick',
  'homePosterSpring',
  'homePosterDrag',
  'networkFloatSpeed',
  'networkPointerInfluence',
  'networkMorphAttack',
  'networkMorphElastic',
  'networkMorphDamping',
  'networkForegroundDepth',
  'transitionSpring',
  'transitionDamping',
  'transitionWaveStrength',
  'transitionWaveFrequency',
  'transitionRowDelay',
  'transitionDepthShift',
];
const WORKS = [
  {
    id: 'afterglow',
    title: 'YANI NEKO',
    localTitle: '尼古喵喵',
    poster: '/media/works/cigarette-and-her/home-poster.webp',
    videos: [
      '/media/works/cigarette-and-her/segments/segment-01.mp4',
      '/media/works/cigarette-and-her/segments/segment-02.mp4',
      '/media/works/cigarette-and-her/segments/segment-03.mp4',
    ],
    audio: '/media/audio/cigarette-and-her-bgm.m4a',
  },
  {
    id: 'tide',
    title: 'EVANGELION',
    localTitle: 'EVA',
    poster: '/media/works/eva/home-poster.webp',
    videos: [
      '/media/works/eva/segments/segment-01.mp4',
      '/media/works/eva/segments/segment-02.mp4',
      '/media/works/eva/segments/segment-03.mp4',
    ],
    audio: '/media/audio/eva-bgm.m4a',
  },
  {
    id: 'ember',
    title: 'COSMIC PRINCESS KAGUYA',
    localTitle: '超时空辉夜姬',
    poster: '/media/works/kaguya/home-poster.webp',
    videos: [
      '/media/works/kaguya/segments/segment-01.mp4',
      '/media/works/kaguya/segments/segment-02.mp4',
      '/media/works/kaguya/segments/segment-03.mp4',
    ],
    audio: '/media/audio/kaguya-bgm.m4a',
  },
  {
    id: 'glass',
    title: 'LIZ AND THE BLUE BIRD',
    localTitle: '利兹与青鸟',
    poster: '/media/works/liz-and-blue-bird/home-poster.webp',
    videos: [
      '/media/works/liz-and-blue-bird/segments/segment-01.mp4',
      '/media/works/liz-and-blue-bird/segments/segment-02.mp4',
      '/media/works/liz-and-blue-bird/segments/segment-03.mp4',
    ],
    audio: '/media/audio/liz-and-blue-bird-bgm.m4a',
  },
  {
    id: 'signal',
    title: 'AVE MUJICA',
    localTitle: 'Ave Mujica',
    poster: '/media/works/ave-mujica/home-poster.webp',
    videos: [
      '/media/works/ave-mujica/segments/segment-01.mp4',
      '/media/works/ave-mujica/segments/segment-02.mp4',
      '/media/works/ave-mujica/segments/segment-03.mp4',
    ],
    audio: '/media/audio/ave-mujica-bgm.m4a',
  },
];
const errors = [];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: REFERENCE_VIEWPORT,
  deviceScaleFactor: 1,
});
attachPageDiagnostics(page, 'main');

try {
  if (shouldVerify('home')) await verifyHome(page);
  if (shouldVerify('control')) await verifyControlPanel(browser);
  if (shouldVerify('transition')) await verifyTransitionLab(page);
  if (shouldVerify('detail')) {
    await verifyWorkDetail(page);
    await verifyReducedMotionDetail(browser);
  }
  if (shouldVerify('studio')) await verifyStudio(page);
  if (shouldVerify('guard')) await verifyDesktopGuard(page);

  if (errors.length) {
    throw new Error(`浏览器报告错误：\n${errors.join('\n')}`);
  }

  console.log('FLOWFRAME UI verification passed.');
} finally {
  await browser.close();
}

async function verifyHome(target) {
  await target.setViewportSize(REFERENCE_VIEWPORT);
  await target.goto(`${targetUrl}#/`, { waitUntil: 'networkidle' });
  await target.locator('.ff-home').waitFor({ state: 'visible' });
  await target.waitForTimeout(900);

  const posters = target.locator('[data-home-poster]');
  assert((await posters.count()) === 5, '首页必须显示 5 个作品入口。');
  assert((await target.locator('[data-home-poster].is-active').count()) === 1, '首页必须只有一张当前海报。');
  assert((await target.locator('.ff-home__asset-badge').count()) === 5, '全部占位海报必须显示状态。');
  assert((await target.locator('.ff-home__scene').getAttribute('data-render-engine')) === 'three-webgl', '首页没有使用 Three.js WebGL 场景。');
  assert((await target.locator('.ff-home__scene').getAttribute('data-poster-meshes')) === '5', '首页 3D 场景没有创建 5 个海报网格。');
  assert(Number(await target.locator('.ff-home__scene').getAttribute('data-network-nodes')) >= 10, '首页没有创建浮动节点系统。');
  assert(Number(await target.locator('.ff-home__scene').getAttribute('data-network-connections')) >= 18, '首页节点没有形成动态连线。');
  assert((await target.locator('.ff-home__scene canvas').count()) === 1, '首页缺少 WebGL 画布。');
  const posterSources = await target.locator('[data-home-poster-image]').evaluateAll((images) => images.map((image) => ({
    src: image.getAttribute('src'),
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  })));
  assert(posterSources.length === WORKS.length, '首页海报图片数量与作品数量不一致。');
  WORKS.forEach((work, index) => {
    assert(posterSources[index]?.src === publicAssetPath(work.poster), `首页 ${work.id} 海报路径不正确。`);
    assert(posterSources[index]?.naturalWidth > 0 && posterSources[index]?.naturalHeight > 0, `首页 ${work.id} 海报没有成功解码。`);
  });

  const firstShot = await target.screenshot({ path: join(outputDir, 'home-implementation-1586x992.png') });
  assertImageHasDetail(firstShot, '首页');
  const homeType = await target.evaluate(() => {
    const size = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return {
      title: size('.ff-home__copy h1'),
      english: size('.ff-home__title-en'),
      meta: size('.ff-home__meta'),
      brand: size('.ff-home__brand > span'),
      navigation: size('.ff-home__navigation'),
    };
  });
  assert(homeType.title >= 58 && homeType.english >= 14 && homeType.meta >= 10, '主页核心文字没有形成足够视觉重点。');
  assert(homeType.brand >= 12 && homeType.navigation >= 9, '主页边角字体仍然过小。');

  const homeSound = target.locator('[data-home-sound]');
  assert((await homeSound.textContent())?.trim() === 'SOUND ON', '首页声音没有默认处于开启意图。');
  assert((await homeSound.getAttribute('aria-pressed')) === 'true', '首页默认声音状态没有暴露给辅助技术。');
  await target.mouse.click(24, 220);
  await target.waitForFunction(() => {
    const audio = document.querySelector('audio[data-flowframe-bgm]');
    return audio && audio.readyState >= 2 && !audio.paused;
  });
  const bgmTimeA = await target.locator('audio[data-flowframe-bgm]').evaluate((audio) => audio.currentTime);
  await target.waitForFunction(
    (startTime) => document.querySelector('audio[data-flowframe-bgm]')?.currentTime > startTime + 0.1,
    bgmTimeA,
    { timeout: 2500 },
  );
  await assertBgmTrack(target, WORKS[0], { expectPlaying: true });

  await target.mouse.move(80, 130);
  await target.waitForTimeout(260);
  const pointerA = await readPointer(target);
  await target.mouse.move(1510, 870);
  await target.waitForFunction(() => {
    const scene = document.querySelector('.ff-home__scene');
    return Number(scene?.dataset.activePosterX) > 0.12
      && Number(scene?.dataset.activePosterY) < -0.08
      && Number(scene?.dataset.activePosterDepth) > 0.16;
  }, null, { timeout: 2400 });
  const pointerB = await readPointer(target);
  assert(pointerA.x !== pointerB.x && pointerA.y !== pointerB.y, '首页鼠标视差没有响应。');

  const scene = target.locator('.ff-home__scene');
  const posterMotion = {
    x: Number(await scene.getAttribute('data-active-poster-x')),
    y: Number(await scene.getAttribute('data-active-poster-y')),
    depth: Number(await scene.getAttribute('data-active-poster-depth')),
    rotateX: Number(await scene.getAttribute('data-active-poster-rotate-x')),
    rotateY: Number(await scene.getAttribute('data-active-poster-rotate-y')),
  };
  assert(
    Math.abs(posterMotion.x) > 0.12 && Math.abs(posterMotion.y) > 0.08,
    `活动画框鼠标吸附仍然过弱：${JSON.stringify(posterMotion)}`,
  );
  assert(posterMotion.depth > 0.16, '活动画框没有产生可见 Z 轴前移。');
  assert(Math.abs(posterMotion.rotateX) > 1 && Math.abs(posterMotion.rotateY) > 1, '活动画框没有产生可见三维倾斜。');

  const initialTopology = await scene.getAttribute('data-network-topology');
  const morphSequenceStart = Number(await scene.getAttribute('data-network-morph-sequence'));

  for (let index = 1; index < WORKS.length; index += 1) {
    await target.locator('[data-home-next]').click();
    await target.waitForFunction(
      (expectedTitle) => document.querySelector('[data-home-title]')?.textContent?.trim() === expectedTitle,
      WORKS[index].localTitle,
    );
    await target.waitForFunction(
      ({ start, expected }) => Number(document.querySelector('.ff-home__scene')?.dataset.networkMorphSequence) === start + expected,
      { start: morphSequenceStart, expected: index },
    );
    if (index === 1) {
      await target.waitForTimeout(140);
      const progress = Number(await scene.getAttribute('data-network-morph-progress'));
      const switchMotion = {
        kick: Number(await scene.getAttribute('data-poster-switch-kick')),
        velocity: Number(await scene.getAttribute('data-active-poster-velocity')),
        settleError: Number(await scene.getAttribute('data-poster-settle-error')),
        foregroundNodes: Number(await scene.getAttribute('data-network-foreground-nodes')),
      };
      assert(progress > 0 && progress < 1, '动态网络没有暴露三维形态切换中段。');
      assert((await scene.getAttribute('data-network-topology')) !== initialTopology, '切换封面后网络形态没有变化。');
      assert(switchMotion.kick > 0 && switchMotion.velocity > 0.02, `封面切换没有可观测起始冲量：${JSON.stringify(switchMotion)}`);
      assert(switchMotion.settleError > 0.01, `封面切换没有产生可回弹的位移误差：${JSON.stringify(switchMotion)}`);
      await target.waitForFunction(
        () => Number(document.querySelector('.ff-home__scene')?.dataset.networkForegroundNodes) >= 1,
        undefined,
        { timeout: 1800 },
      );
      const foregroundNodes = Number(await scene.getAttribute('data-network-foreground-nodes'));
      assert(foregroundNodes >= 1, `动态网络没有节点穿到活动封面前方：${JSON.stringify({ ...switchMotion, foregroundNodes })}`);
      await target.screenshot({ path: join(outputDir, 'home-network-morph-1586x992.png') });
      await target.waitForFunction(
        (startError) => Number(document.querySelector('.ff-home__scene')?.dataset.posterSettleError) < startError * 0.55,
        switchMotion.settleError,
        { timeout: 3200 },
      );
    }
    await assertBgmTrack(target, WORKS[index], { expectPlaying: Boolean(WORKS[index].audio) });
  }

  await target.locator('[data-home-next]').click();
  await target.waitForFunction(
    (expectedTitle) => document.querySelector('[data-home-title]')?.textContent?.trim() === expectedTitle,
    WORKS[0].localTitle,
  );
  await assertBgmTrack(target, WORKS[0], { expectPlaying: true });

  await target.locator('[data-home-next]').click();
  await target.waitForFunction(
    (expectedTitle) => document.querySelector('[data-home-title]')?.textContent?.trim() === expectedTitle,
    WORKS[1].localTitle,
  );
  await assertBgmTrack(target, WORKS[1], { expectPlaying: true });

  await target.locator('[data-home-enter]').click();
  await target.waitForURL(/#\/works\/tide$/);
  await waitForDetailIdle(target);
  assert((await target.locator('.work-detail').getAttribute('data-work-id')) === 'tide', '首页没有进入当前作品详情。');
  const renderer = await readRendererStats(target);
  assert((await target.locator('.work-visual-stage canvas').count()) === 1, '正式作品入口缺少 WebGL Canvas。');
  assert(renderer.textureCount >= 1 && renderer.textureCount <= 2, '正式作品入口没有只保留 current/next 纹理。');
  assert((await target.locator('[data-detail-sound]').textContent())?.trim() === 'SOUND ON', 'BGM 状态没有在路由之间保留。');
  await target.locator('[data-detail-sound]').click();
  assert(await target.locator('audio[data-flowframe-bgm]').evaluate((audio) => audio.paused), '详情页没有关闭 BGM。');
}

async function verifyControlPanel(browserInstance) {
  const target = await browserInstance.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  attachPageDiagnostics(target, 'control-panel');

  try {
    await target.goto(`${targetUrl}#/`, { waitUntil: 'networkidle' });
    await target.evaluate(async () => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      await new Promise((resolvePromise, rejectPromise) => {
        const request = indexedDB.deleteDatabase('flowframe-media-v1');
        request.onsuccess = () => resolvePromise();
        request.onerror = () => rejectPromise(request.error);
        request.onblocked = () => resolvePromise();
      });
    });
    await target.reload({ waitUntil: 'networkidle' });
    await target.locator('.ff-home').waitFor({ state: 'visible' });

    const controls = target.locator('.ff-control');
    const toggle = target.locator('.ff-control__toggle');
    assert((await controls.getAttribute('data-open')) === 'false', '控制台没有默认收起。');
    await toggle.click();
    assert((await controls.getAttribute('data-open')) === 'true', '控制台图形开关没有打开面板。');
    assert(MOTION_FIELDS.length === EXPECTED_MOTION_COUNT, `共享 motion schema 应包含 ${EXPECTED_MOTION_COUNT} 项，实际为 ${MOTION_FIELDS.length}。`);
    assert((await target.locator('[data-motion-range]').count()) === MOTION_FIELDS.length, '控制台滑动参数数量与共享 schema 不一致。');
    assert((await target.locator('[data-motion-number]').count()) === MOTION_FIELDS.length, '控制台精确数值参数数量与共享 schema 不一致。');
    for (const key of NEW_MOTION_KEYS) {
      assert((await target.locator(`[data-motion-range="${key}"]`).count()) === 1, `控制台缺少新增参数 ${key} 的滑块。`);
      assert((await target.locator(`[data-motion-number="${key}"]`).count()) === 1, `控制台缺少新增参数 ${key} 的精确输入。`);
    }
    const readablePanel = await target.locator('.ff-control__panel').evaluate((panel) => {
      const box = panel.getBoundingClientRect();
      const scroll = panel.querySelector('[data-control-scroll]');
      const parameterLabel = panel.querySelector('.ff-control__parameter > span');
      const numberInput = panel.querySelector('[data-motion-number]');
      return {
        width: box.width,
        height: box.height,
        bottom: box.bottom,
        contentHeight: scroll?.scrollHeight || 0,
        viewportHeight: scroll?.clientHeight || 0,
        overflowY: scroll ? getComputedStyle(scroll).overflowY : '',
        labelFontSize: parameterLabel ? Number.parseFloat(getComputedStyle(parameterLabel).fontSize) : 0,
        numberFontSize: numberInput ? Number.parseFloat(getComputedStyle(numberInput).fontSize) : 0,
        numberHeight: numberInput?.getBoundingClientRect().height || 0,
      };
    });
    assert(readablePanel.width >= 438 && readablePanel.width <= 582, `控制台没有使用 440–580px 的可读响应式宽度：${JSON.stringify(readablePanel)}`);
    assert(readablePanel.bottom <= 714, '控制台超出 1280×720 可见区域。');
    assert(readablePanel.overflowY === 'auto', '控制台内容区没有启用独立滚动。');
    assert(readablePanel.labelFontSize >= 11 && readablePanel.numberFontSize >= 11 && readablePanel.numberHeight >= 27, '控制台参数文字或数值输入仍然过小。');
    assert(readablePanel.contentHeight > readablePanel.viewportHeight + 2, 'MOTION 内容没有形成预期的可滚动区域。');
    const motionScrollTop = await target.locator('[data-control-scroll]').evaluate((scroll) => {
      scroll.scrollTop = scroll.scrollHeight;
      return scroll.scrollTop;
    });
    assert(motionScrollTop > 0, 'MOTION 内容区不能实际滚动。');
    await target.locator('[data-control-scroll]').evaluate((scroll) => { scroll.scrollTop = 0; });
    await target.screenshot({ path: join(outputDir, 'control-home-1280x720.png') });

    await target.setViewportSize({ width: 1512, height: 982 });
    const laptopPanel = await target.locator('.ff-control__panel').boundingBox();
    assert(laptopPanel?.width >= 438 && laptopPanel?.width <= 462, '缩放笔记本视口下控制台宽度不正确。');
    await target.screenshot({ path: join(outputDir, 'control-home-1512x982.png') });

    await target.setViewportSize({ width: 2560, height: 1440 });
    const twoKPanel = await target.locator('.ff-control__panel').boundingBox();
    assert(twoKPanel?.width >= 578 && twoKPanel?.width <= 582, '2K 视口下控制台没有放大到约 580px。');
    await target.screenshot({ path: join(outputDir, 'control-home-2560x1440.png') });
    await target.setViewportSize({ width: 1280, height: 720 });

    const attractionNumber = target.locator('[data-motion-number="homePosterAttraction"]');
    await attractionNumber.fill('1.12');
    assert((await target.locator('[data-motion-range="homePosterAttraction"]').inputValue()) === '1.12', '控制台 range 和 number 没有双向同步。');
    await target.waitForFunction(() => window.flowframeRuntime?.getProject?.().motion.homePosterAttraction === 1.12);
    await target.mouse.move(1180, 620);
    await target.waitForFunction(() => Number(document.querySelector('.ff-home__scene')?.dataset.activePosterX) > 0.12);
    const liveAttraction = Number(await target.locator('.ff-home__scene').getAttribute('data-active-poster-x'));
    await attractionNumber.fill('0');
    await target.waitForFunction(() => Math.abs(Number(document.querySelector('.ff-home__scene')?.dataset.activePosterX)) < 0.025);
    await attractionNumber.fill('1.12');
    await target.waitForFunction((previous) => Number(document.querySelector('.ff-home__scene')?.dataset.activePosterX) >= previous * 0.82, liveAttraction);
    const realtimeParameters = {
      homePosterSwitchKick: 1.65,
      networkForegroundDepth: 3.1,
      transitionSpring: 56,
      transitionDamping: 10.4,
      transitionWaveStrength: 1.35,
      transitionWaveFrequency: 1.7,
      transitionRowDelay: 1.4,
      transitionDepthShift: 1.6,
    };
    for (const [key, value] of Object.entries(realtimeParameters)) {
      await target.locator(`[data-motion-number="${key}"]`).fill(String(value));
      assert(
        (await target.locator(`[data-motion-range="${key}"]`).inputValue()) === String(value),
        `新增参数 ${key} 的 range 和 number 没有双向同步。`,
      );
      await target.waitForFunction(
        ({ motionKey, expected }) => window.flowframeRuntime?.getProject?.().motion?.[motionKey] === expected,
        { motionKey: key, expected: value },
      );
    }
    assert((await controls.getAttribute('data-dirty')) === 'true', '控制台没有显示未保存状态。');

    await target.evaluate(() => { window.location.hash = '#/works/afterglow'; });
    await waitForDetailIdle(target);
    assert((await controls.getAttribute('data-open')) === 'true', '控制台跳转详情页后没有保持打开。');
    assert((await target.locator('[data-motion-number="homePosterAttraction"]').inputValue()) === '1.12', '控制台跨路由丢失草稿。');
    const detailMotionBridge = await target.evaluate(() => ({
      stats: window.__FLOWFRAME_DETAIL_DEBUG__?.getRendererStats?.().motion,
      dataset: {
        spring: Number(document.querySelector('.work-detail')?.dataset.transitionSpring),
        damping: Number(document.querySelector('.work-detail')?.dataset.transitionDamping),
        waveStrength: Number(document.querySelector('.work-detail')?.dataset.transitionWaveStrength),
        waveFrequency: Number(document.querySelector('.work-detail')?.dataset.transitionWaveFrequency),
        rowDelay: Number(document.querySelector('.work-detail')?.dataset.transitionRowDelay),
        depthShift: Number(document.querySelector('.work-detail')?.dataset.transitionDepthShift),
      },
    }));
    assert(detailMotionBridge.dataset.spring === realtimeParameters.transitionSpring, `详情 motion controller 没有收到 transitionSpring：${JSON.stringify(detailMotionBridge)}`);
    assert(detailMotionBridge.dataset.damping === realtimeParameters.transitionDamping, `详情 motion controller 没有收到 transitionDamping：${JSON.stringify(detailMotionBridge)}`);
    for (const key of ['transitionWaveStrength', 'transitionWaveFrequency', 'transitionRowDelay', 'transitionDepthShift']) {
      const datasetKey = {
        transitionWaveStrength: 'waveStrength',
        transitionWaveFrequency: 'waveFrequency',
        transitionRowDelay: 'rowDelay',
        transitionDepthShift: 'depthShift',
      }[key];
      assert(
        detailMotionBridge.stats?.[key] === realtimeParameters[key]
          && detailMotionBridge.dataset[datasetKey] === realtimeParameters[key],
        `详情 renderer stats/dataset 没有实时收到 ${key}：${JSON.stringify(detailMotionBridge)}`,
      );
    }
    await target.screenshot({ path: join(outputDir, 'control-detail-1280x720.png') });
    await target.keyboard.press('Escape');
    assert((await controls.getAttribute('data-open')) === 'false', 'Escape 没有优先关闭控制台。');
    assert((await target.locator('.work-detail').getAttribute('data-detail-state')) === 'idle', '关闭控制台时错误改变了详情状态。');

    await toggle.click();
    await target.locator('[data-action="undo"]').click();
    assert((await target.locator('[data-motion-number="homePosterAttraction"]').inputValue()) === '0.78', '撤销未保存修改没有恢复保存值。');
    assert((await controls.getAttribute('data-dirty')) === 'false', '撤销后控制台仍显示未保存。');

    await target.locator('[data-motion-number="playInkDuration"]').fill('0.61');
    await target.locator('.ff-control__save').click();
    await target.waitForFunction(() => JSON.parse(window.localStorage.getItem('flowframe-project-v1')).motion.playInkDuration === 0.61);
    await target.waitForFunction(() => document.querySelector('.ff-control')?.dataset.dirty === 'false');
    assert((await controls.getAttribute('data-dirty')) === 'false', '保存后控制台仍显示未保存。');

    await target.reload({ waitUntil: 'networkidle' });
    await waitForDetailIdle(target);
    assert((await target.locator('.ff-control').getAttribute('data-open')) === 'true', '控制台打开状态没有在刷新后保留。');
    assert((await target.locator('[data-motion-number="playInkDuration"]').inputValue()) === '0.61', '保存后的动效参数没有恢复。');
    assert((await target.locator('[data-detail-play]').getAttribute('data-ink-duration')) === '0.61', 'PLAY 墨滴没有实时读取控制台保存参数。');

    await target.locator('[data-action="tab"][data-tab="media"]').click();
    assert((await target.locator('[data-work-select] option').count()) === 5, '媒体控制台默认作品数量错误。');
    assert((await target.locator('.ff-control__work').count()) === 1, '媒体控制台没有使用单作品紧凑视图。');
    const mediaFit = await target.locator('[data-control-scroll]').evaluate((scroll) => ({
      contentHeight: scroll.scrollHeight,
      viewportHeight: scroll.clientHeight,
      overflowY: getComputedStyle(scroll).overflowY,
    }));
    assert(mediaFit.overflowY === 'auto', 'MEDIA 素材管理没有使用独立滚动区。');
    if (mediaFit.contentHeight > mediaFit.viewportHeight + 2) {
      const mediaScrollTop = await target.locator('[data-control-scroll]').evaluate((scroll) => {
        scroll.scrollTop = scroll.scrollHeight;
        return scroll.scrollTop;
      });
      assert(mediaScrollTop > 0, 'MEDIA 内容超过面板后不能实际滚动。');
      await target.locator('[data-control-scroll]').evaluate((scroll) => { scroll.scrollTop = 0; });
    }
    await target.screenshot({ path: join(outputDir, 'control-media-1280x720.png') });
    await target.locator('[data-action="work-add"]').click();
    assert((await target.locator('[data-work-select] option').count()) === 6, '媒体控制台不能新增作品。');
    await target.locator('.ff-control__work [data-action="work-delete"]').click();
    assert((await target.locator('[data-work-select] option').count()) === 5, '媒体控制台不能删除作品。');
    await target.locator('[data-work-select]').selectOption('0');

    let firstWork = target.locator('.ff-control__work').first();
    assert((await firstWork.locator('[data-clip-select] option').count()) === 3, '媒体控制台没有读取默认片段。');
    assert((await firstWork.locator('.ff-control__clip').count()) === 1, '媒体控制台没有使用单片段紧凑视图。');
    await firstWork.locator('[data-action="clip-add"]').click();
    firstWork = target.locator('.ff-control__work').first();
    assert((await firstWork.locator('[data-clip-select] option').count()) === 4, '媒体控制台不能新增片段。');
    await firstWork.locator('.ff-control__clip [data-action="clip-delete"]').click();
    firstWork = target.locator('.ff-control__work').first();
    assert((await firstWork.locator('[data-clip-select] option').count()) === 3, '媒体控制台不能删除片段。');
    await firstWork.locator('[data-clip-select]').selectOption('0');

    await firstWork.locator('[data-local-kind="image"]').setInputFiles(resolve(currentDir, '../public/media/posters/afterglow-placeholder.webp'));
    await target.waitForFunction(() => window.flowframeRuntime.getProject().works[0].coverImage.startsWith('idb://flowframe/'));
    firstWork = target.locator('.ff-control__work').first();
    await firstWork.locator('[data-local-kind="audio"]').setInputFiles(resolve(currentDir, '../public/media/audio/ave-mujica-bgm.m4a'));
    await target.waitForFunction(() => window.flowframeRuntime.getProject().works[0].audioSrc.startsWith('idb://flowframe/'));
    firstWork = target.locator('.ff-control__work').first();
    await firstWork.locator('[data-local-kind="video"]').first().setInputFiles(resolve(currentDir, '../public/media/placeholders/afterglow-01.mp4'));
    await target.waitForFunction(() => window.flowframeRuntime.getProject().works[0].clips[0].src.startsWith('idb://flowframe/'));
    await target.waitForFunction(async () => (await window.flowframeRuntime.getAssetStore().list()).length === 3);
    const runtimeSources = await target.evaluate(() => ({
      cover: window.flowframeRuntime.getRuntimeProject().works[0].coverImage,
      audio: window.flowframeRuntime.getRuntimeProject().works[0].audioSrc,
      video: window.flowframeRuntime.getRuntimeProject().works[0].clips[0].src,
    }));
    assert(Object.values(runtimeSources).every((value) => value.startsWith('blob:')), 'IndexedDB 本地素材没有解析为运行时 Blob URL。');

    await target.locator('.ff-control__save').click();
    await target.waitForFunction(() => {
      const project = JSON.parse(window.localStorage.getItem('flowframe-project-v1'));
      return project.works[0].coverImage.startsWith('idb://flowframe/')
        && project.works[0].audioSrc.startsWith('idb://flowframe/')
        && project.works[0].clips[0].src.startsWith('idb://flowframe/');
    });
    await target.waitForFunction(() => document.querySelector('.ff-control')?.dataset.dirty === 'false');
    await target.reload({ waitUntil: 'networkidle' });
    await waitForDetailIdle(target);
    const restoredSources = await target.evaluate(() => ({
      canonical: window.flowframeRuntime.getProject().works[0],
      runtime: window.flowframeRuntime.getRuntimeProject().works[0],
    }));
    assert(restoredSources.canonical.coverImage.startsWith('idb://flowframe/'), '刷新后丢失本地封面引用。');
    assert(restoredSources.runtime.coverImage.startsWith('blob:'), '刷新后本地封面没有恢复。');
    assert(restoredSources.runtime.audioSrc.startsWith('blob:'), '刷新后本地音乐没有恢复。');
    assert(restoredSources.runtime.clips[0].src.startsWith('blob:'), '刷新后本地短片没有恢复。');

    await target.locator('[data-action="tab"][data-tab="media"]').click();
    firstWork = target.locator('.ff-control__work').first();
    await firstWork.locator('[data-action="cover-clear"]').click();
    firstWork = target.locator('.ff-control__work').first();
    await firstWork.locator('[data-action="audio-clear"]').click();
    firstWork = target.locator('.ff-control__work').first();
    await firstWork.locator('.ff-control__clip').first().locator('[data-action="clip-delete"]').click();
    await target.locator('.ff-control__save').click();
    await target.waitForFunction(async () => (await window.flowframeRuntime.getAssetStore().list()).length === 0);

    target.once('dialog', (dialog) => dialog.accept());
    await target.locator('[data-action="reset-all"]').click();
    await target.waitForFunction(() => window.flowframeRuntime.getProject().motion.playInkDuration === 0.48);
    assert(windowIsDefaultWorkCount(await target.evaluate(() => window.flowframeRuntime.getProject().works.length)), '控制台恢复默认后作品数量错误。');
  } finally {
    await target.close();
  }
}

function windowIsDefaultWorkCount(count) {
  return count === 5;
}

async function verifyTransitionLab(target) {
  await target.goto(`${targetUrl}#/lab/transition`, { waitUntil: 'networkidle' });
  await target.locator('.tx-experience.is-ready').waitFor({ state: 'visible' });
  await target.waitForTimeout(500);

  assert((await target.locator('video').count()) === 2, '转场试验只能保留当前和下一个视频。');
  assert((await target.locator('.tx-progress-button').count()) === 3, '转场试验必须包含 3 个占位片段。');
  assert(await target.locator('.tx-placeholder').isVisible(), '转场试验必须显示 PLACEHOLDER MEDIA。');
  assert(await target.locator('.tx-mode strong').isVisible(), '转场试验必须显示 LAB。');
  await assertActiveVideoReady(target, 'segment-01.mp4');
  await target.screenshot({ path: join(outputDir, 'transition-lab-initial-1586x992.png') });

  const initialTitle = (await target.locator('.tx-title').textContent())?.trim();
  await target.locator('.tx-control--next').click();
  await target.waitForTimeout(420);
  assert(await target.locator('.tx-experience.is-transitioning').isVisible(), '转场进行状态没有出现。');
  assert(await target.locator('.tx-placeholder').isVisible(), '转场进行时占位声明消失。');
  assert(
    (await target.locator('.tx-title').textContent())?.trim() === initialTitle,
    '转场文字没有按媒体之后延迟更新。',
  );
  await assertTransitionMotion(target);
  await target.screenshot({ path: join(outputDir, 'transition-lab-moving-1586x992.png') });

  await waitForTransitionToFinish(target);
  assert((await target.locator('.tx-current-number').textContent())?.trim() === '02', '转场完成后编号不正确。');
  assert((await target.locator('.tx-experience.is-transitioning').count()) === 0, '转场完成后仍处于输入锁定状态。');
  assert((await target.locator('video').count()) === 2, '转场完成后视频层数量发生变化。');
  await assertActiveVideoReady(target, 'segment-02.mp4');

  await target.locator('.tx-control--next').click();
  await target.waitForTimeout(80);
  await waitForTransitionToFinish(target);
  assert((await target.locator('.tx-current-number').textContent())?.trim() === '03', '第三段占位视频没有正常接管。');
  await assertActiveVideoReady(target, 'segment-03.mp4');

  await target.locator('.tx-control--next').click();
  await target.locator('.tx-control--next').click();
  await target.locator('.tx-control--next').click();
  // 每次包含媒体切换和文字延迟；连续输入只会再排队一次。
  await target.waitForTimeout(5600);
  assert((await target.locator('.tx-experience.is-transitioning').count()) === 0, '连续输入后转场卡住。');
  assert((await target.locator('video').count()) === 2, '连续输入后视频层数量发生变化。');
}

async function verifyStudio(target) {
  await target.goto(`${targetUrl}#/studio`, { waitUntil: 'networkidle' });
  await target.evaluate(() => window.localStorage.clear());
  await verifyVersionTwoMigration(target);
  await target.evaluate(() => window.localStorage.clear());
  await target.reload({ waitUntil: 'networkidle' });
  await target.locator('.studio-shell').waitFor({ state: 'visible' });
  await target.screenshot({ path: join(outputDir, 'studio-implementation-1586x992.png') });

  assert((await target.locator('[data-work-count]').inputValue()) === '5', '调节页默认作品数量不正确。');
  assert((await target.locator('[data-motion]').count()) === MOTION_FIELDS.length, '调节页动效参数数量与共享 schema 不一致。');
  assert((await target.locator('.studio-placeholder-stamp').count()) >= 3, '调节页没有清楚标记占位片段。');

  const firstWork = target.locator('.studio-work').first();
  const clipTitles = () => firstWork.locator('.studio-clip__topline strong').allTextContents();
  const originalClipTitles = await clipTitles();

  await firstWork.locator('[data-action="clip-down"][data-clip="0"]').click();
  assert(
    (await clipTitles())[0]?.includes('GARDEN'),
    '片段向下排序没有生效。',
  );
  await firstWork.locator('[data-action="clip-up"][data-clip="1"]').click();
  assert(
    JSON.stringify(await clipTitles()) === JSON.stringify(originalClipTitles),
    '片段向上排序没有恢复原顺序。',
  );

  await firstWork.locator('[data-action="clip-add"]').click();
  assert((await firstWork.locator('.studio-clip').count()) === 4, '添加片段没有生效。');
  assert(
    await firstWork.locator('.studio-clip').last().locator('.studio-placeholder-stamp').isVisible(),
    '新增片段没有标明占位素材。',
  );
  await firstWork.locator('[data-action="clip-delete"][data-clip="3"]').click();
  assert((await firstWork.locator('.studio-clip').count()) === 3, '删除片段没有生效。');

  const workCount = target.locator('[data-work-count]');
  await workCount.fill('1');
  await workCount.press('Tab');
  assert((await target.locator('.studio-work').count()) === 1, '作品数量不能减少到 1。');
  await target.locator('[data-work-count]').fill('6');
  await target.locator('[data-work-count]').press('Tab');
  assert((await target.locator('.studio-work').count()) === 6, '作品数量不能恢复到 6。');

  const duration = target.locator('[data-motion="transitionDuration"]');
  await duration.fill('2.2');
  await target.reload({ waitUntil: 'networkidle' });
  assert(
    (await target.locator('[data-motion="transitionDuration"]').inputValue()) === '1.1',
    '未保存的调节参数不应在刷新后保留。',
  );

  const motionValues = {
    homePointerX: '0.74',
    homePointerY: '0.48',
    homeDamping: '0.095',
    homeCameraTravel: '1.35',
    homePosterAttraction: '0.91',
    homePosterTilt: '7.2',
    homePosterDepth: '0.52',
    networkMorphDuration: '1.2',
    networkMorphDepth: '2.4',
    networkMorphRotation: '19',
    networkFloatStrength: '1.15',
    transitionDuration: '2.2',
    transitionDistortion: '0.88',
    transitionScale: '1.18',
    transitionBlur: '12',
    transitionMaskAngle: '-22',
    transitionTextDelay: '0.28',
    playInkDelay: '0.11',
    playInkDuration: '0.55',
    playInkElastic: '0.8',
    playInkDistortion: '0.2',
  };
  for (const [key, value] of Object.entries(motionValues)) {
    await target.locator(`[data-motion="${key}"]`).fill(value);
  }
  await target.locator('.studio-shell [data-action="save"]').click();
  assert((await target.locator('.studio-notice').textContent())?.includes('已保存'), '调节页没有给出保存结果。');

  await target.reload({ waitUntil: 'networkidle' });
  for (const [key, value] of Object.entries(motionValues)) {
    assert(
      (await target.locator(`[data-motion="${key}"]`).inputValue()) === value,
      `动效参数 ${key} 保存后没有保留。`,
    );
  }

  const downloadPromise = target.waitForEvent('download');
  await target.locator('.studio-shell [data-action="export"]').click();
  const download = await downloadPromise;
  assert(/^flowframe-project-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), '导出文件名不正确。');
  const downloadPath = await download.path();
  const exportedProject = JSON.parse(await readFile(downloadPath, 'utf8'));
  assert(exportedProject.motion.transitionDuration === 2.2, '导出的 JSON 没有包含当前动效参数。');
  assert(Array.isArray(exportedProject.works) && exportedProject.works.length === 5, '导出的 JSON 作品列表不正确。');

  const importedProject = {
    version: 1,
    title: 'FLOWFRAME IMPORT CHECK',
    assetNotice: 'PLACEHOLDER MEDIA',
    motion: { transitionDuration: 2.65, transitionMaskAngle: 18 },
    works: [
      {
        id: 'import-check',
        title: '导入验收',
        titleEn: 'IMPORT CHECK',
        poster: '',
        posterStatus: 'missing',
        clips: [
          {
            id: 'import-check-01',
            title: 'IMPORTED CLIP',
            src: '',
            poster: '',
            status: 'missing',
          },
        ],
      },
    ],
  };
  const importInput = target.locator('[data-import]');
  await importInput.setInputFiles({
    name: 'flowframe-import-check.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedProject)),
  });
  await target.locator('.studio-notice', { hasText: '已导入' }).waitFor({ state: 'visible' });
  assert((await target.locator('.studio-work').count()) === 1, '导入后作品数量不正确。');
  assert((await target.locator('[data-motion="transitionDuration"]').inputValue()) === '2.65', '导入后动效参数不正确。');
  assert((await target.locator('[data-field="work-title"]').inputValue()) === '导入验收', '导入后作品标题不正确。');

  await target.reload({ waitUntil: 'networkidle' });
  assert((await target.locator('.studio-work').count()) === 5, '未保存的导入内容不应在刷新后保留。');
  assert((await target.locator('[data-motion="transitionDuration"]').inputValue()) === '2.2', '未保存导入覆盖了已保存参数。');

  await target.locator('[data-import]').setInputFiles({
    name: 'flowframe-import-check.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedProject)),
  });
  await target.locator('.studio-notice', { hasText: '已导入' }).waitFor({ state: 'visible' });
  await target.locator('.studio-shell [data-action="save"]').click();
  await target.reload({ waitUntil: 'networkidle' });
  assert((await target.locator('.studio-work').count()) === 1, '导入内容保存后没有保留。');
  assert((await target.locator('[data-field="work-title"]').inputValue()) === '导入验收', '保存后的导入标题不正确。');

  target.once('dialog', (dialog) => dialog.accept());
  await target.locator('.studio-shell [data-action="reset"]').click();
  assert((await target.locator('.studio-notice').textContent())?.includes('已恢复默认'), '恢复默认没有给出结果。');
  assert((await target.locator('.studio-work').count()) === 5, '恢复默认后作品数量不正确。');
  assert((await target.locator('[data-motion="transitionDuration"]').inputValue()) === '1.1', '恢复默认后动效参数不正确。');

  await target.reload({ waitUntil: 'networkidle' });
  assert((await target.locator('.studio-work').count()) === 5, '恢复默认后刷新仍残留导入内容。');
}

async function verifyVersionTwoMigration(target) {
  const legacyProject = {
    version: 2,
    title: 'FLOWFRAME',
    assetNotice: 'PLACEHOLDER MEDIA',
    motion: { transitionDuration: 2.34, homePointerX: 0.77 },
    works: [
      {
        id: 'afterglow',
        title: '香烟与她',
        titleEn: 'CIGARETTE & HER',
        description: '城市、烟雾与猫族少女的短促情绪，被整理为一段节奏明确的角色影像。',
        poster: '/media/works/cigarette-and-her/home-poster.webp',
        videoSrc: '/media/works/cigarette-and-her/segments/segment-01.mp4',
        clips: [{ id: 'old-01', src: '/media/works/cigarette-and-her/segments/segment-01.mp4' }],
      },
      {
        id: 'tide',
        title: '潮汐信号',
        titleEn: 'TIDAL SIGNAL',
        description: '海风、停顿和眼神被剪成一段低频的蓝色回声。',
        poster: '/media/stills/ai/glass-tide.webp',
        videoSrc: '/media/placeholders/afterglow-02.mp4',
        clips: [{ id: 'old-02', src: '/media/placeholders/afterglow-02.mp4' }],
      },
      {
        id: 'ember',
        title: '暗火档案',
        titleEn: 'DARKFIRE ARCHIVE',
        description: '暗红颗粒和短促残影组成一份人物动作档案。',
        poster: '/media/stills/ai/night-transit.webp',
        videoSrc: '/media/placeholders/afterglow-03.mp4',
        clips: [{ id: 'old-03', src: '/media/placeholders/afterglow-03.mp4' }],
      },
      {
        id: 'glass',
        title: '玻璃季风',
        titleEn: 'GLASS MONSOON',
        description: '玻璃折射、高光边缘和干净切点组成轻未来感。',
        poster: '/media/stills/ai/glass-monsoon.webp',
        videoSrc: '/media/placeholders/afterglow-01.mp4',
        clips: [{ id: 'old-04', src: '/media/placeholders/afterglow-01.mp4' }],
      },
      {
        id: 'signal',
        title: '频谱广场',
        titleEn: 'SPECTRUM PLAZA',
        description: '舞台、街区和节拍被整理成明亮而克制的频谱。',
        poster: '/media/stills/ai/spectrum-plaza.webp',
        videoSrc: '/media/placeholders/afterglow-02.mp4',
        clips: [{ id: 'old-05', src: '/media/placeholders/afterglow-02.mp4' }],
      },
      {
        id: 'orbit',
        title: '保留作品',
        titleEn: 'CUSTOM ORBIT',
        description: '用户自定义内容必须保留。',
        poster: '',
        clips: [],
      },
    ],
  };

  await target.evaluate((project) => {
    window.localStorage.setItem('flowframe-project-v1', JSON.stringify(project));
  }, legacyProject);
  await target.reload({ waitUntil: 'networkidle' });
  await target.locator('.studio-shell').waitFor({ state: 'visible' });

  const titles = await target.locator('[data-field="work-title"]').evaluateAll((inputs) => (
    inputs.map((input) => input.value)
  ));
  assert(titles[0] === '尼古喵喵', 'version 2 的作品 01 没有迁移为尼古喵喵。');
  assert(titles[1] === 'EVA', 'version 2 的作品 02 没有迁移为 EVA。');
  assert(titles[2] === '超时空辉夜姬', 'version 2 的作品 03 没有迁移为超时空辉夜姬。');
  assert(titles[3] === '利兹与青鸟', 'version 2 的作品 04 没有迁移为利兹与青鸟。');
  assert(titles[4] === 'Ave Mujica', 'version 2 的作品 05 没有迁移为 Ave Mujica。');
  assert(titles[5] === '保留作品', 'version 2 迁移覆盖了用户自定义作品。');
  assert(
    (await target.locator('[data-motion-output="transitionDuration"]').textContent())?.trim() === '2.34',
    'version 2 迁移丢失了动效参数。',
  );
  assert((await target.locator('[data-motion="homePointerX"]').inputValue()) === '0.77', 'version 2 迁移丢失了主页参数。');

  await target.evaluate(() => {
    window.localStorage.setItem('flowframe-project-v1', JSON.stringify({
      version: 3,
      motion: {
        transitionDuration: 1.45,
        transitionDistortion: 0.62,
      },
      works: [{
        id: 'orbit',
        title: '轨道切片',
        titleEn: 'ORBITAL CUTS',
        poster: '/media/stills/ai/orbital-cuts.webp',
        clips: [{ src: '/media/placeholders/afterglow-01.mp4' }],
      }],
    }));
  });
  await target.reload({ waitUntil: 'networkidle' });
  await target.locator('.studio-shell').waitFor({ state: 'visible' });
  assert((await target.locator('.studio-work').count()) === 5, 'version 3 的旧 AI 默认卡没有被移除。');
  const migratedEnglishTitles = await target.locator('[data-field="work-title-en"]').evaluateAll((inputs) => inputs.map((input) => input.value));
  assert(migratedEnglishTitles.every((title) => title !== 'ORBITAL CUTS'), 'Studio 仍显示旧 AI 默认卡。');
  assert((await target.locator('[data-motion="transitionDistortion"]').inputValue()) === '0.92', '旧默认动效没有升级为更强参数。');
  assert((await target.locator('[data-motion="homePointerX"]').inputValue()) === '1', 'version 4 默认主页跟随没有升级。');
  assert((await target.locator('[data-motion="homePosterAttraction"]').inputValue()) === '0.78', 'v5 画框吸附默认参数缺失。');
  assert((await target.locator('[data-motion="networkMorphDepth"]').inputValue()) === '2.1', 'v5 网络纵深默认参数缺失。');
  assert((await target.locator('[data-motion="playInkDuration"]').inputValue()) === '0.48', 'v5 PLAY 墨滴默认参数缺失。');

  await target.evaluate(() => {
    window.localStorage.setItem('flowframe-project-v1', JSON.stringify({
      version: 4,
      motion: {
        homePointerX: 0.7,
        homePointerY: 0.41,
        homeDamping: 0.072,
        homeCameraTravel: 1.18,
      },
      works: [{ id: 'custom-v4', title: '自定义 v4', titleEn: 'CUSTOM V4', clips: [] }],
    }));
  });
  await target.reload({ waitUntil: 'networkidle' });
  await target.locator('.studio-shell').waitFor({ state: 'visible' });
  assert((await target.locator('[data-motion="homePointerX"]').inputValue()) === '1', 'version 4 的旧默认横向跟随没有升级。');
  assert((await target.locator('[data-motion="homePointerY"]').inputValue()) === '0.41', 'version 4 的用户自定义参数被覆盖。');
  assert((await target.locator('[data-field="work-title"]').inputValue()) === '自定义 v4', 'version 4 的用户作品被覆盖。');
}

async function verifyWorkDetail(target) {
  await target.setViewportSize(DETAIL_REFERENCE_VIEWPORT);
  await target.goto(`${targetUrl}#/works/afterglow`, { waitUntil: 'networkidle' });
  await waitForDetailIdle(target);
  await assertContinuousDetailContract(target);
  await assertWorkDetail(target, WORKS[0], WORKS[1]);
  const referenceShot = await target.screenshot({ path: join(outputDir, 'work-detail-implementation-1440x900.png') });
  assertDetailImageHasRange(referenceShot, '作品详情 1440×900');
  await assertDetailLayout(target, DETAIL_REFERENCE_VIEWPORT);
  await assertBackgroundPlaylistAdvances(target, WORKS[0]);

  for (let index = 0; index < WORKS.length; index += 1) {
    const work = WORKS[index];
    const following = WORKS[(index + 1) % WORKS.length];
    await target.goto(`${targetUrl}#/works/${work.id}`, { waitUntil: 'networkidle' });
    await waitForDetailIdle(target);
    await assertWorkDetail(target, work, following);
    if (index >= 1 && index <= 4) await assertPlayerPlayback(target, work);
  }

  await target.goto(`${targetUrl}#/works/afterglow`, { waitUntil: 'networkidle' });
  await waitForDetailIdle(target);

  const partialBase = await readDetailSnapshot(target);
  const partialHash = target.url();
  await wheelGesture(target, [26, 26]);
  await waitForDetailMotion(target);
  const partialForward = await readDetailSnapshot(target);
  assert(partialForward.detailState === 'switching', '小幅滚轮没有进入连续 switching 状态。');
  assert(partialForward.progress > 0.001 && partialForward.progress < 0.999, '小幅滚轮没有产生 0..1 之间的中间进度。');
  assert(Math.abs(partialForward.position - partialBase.position) > 0.001, '小幅滚轮没有逐帧改变 position。');
  assert(target.url() === partialHash, '部分滚动时提前修改了 hash。');
  await assertRendererContinuity(target, '小幅滚轮中间帧');
  const partialShot = await target.screenshot({ path: join(outputDir, 'work-detail-scroll-partial-1440x900.png') });
  assertDetailImageHasRange(partialShot, '作品详情小幅滚轮中间帧');
  await target.screenshot({ path: join(outputDir, 'work-detail-switching-1440x900.png') });

  await wheelGesture(target, [-34, -34, -24]);
  await waitForDetailReverse(target, partialForward.position);
  const reverseSnapshot = await readDetailSnapshot(target);
  assert(
    reverseSnapshot.direction < 0
      || reverseSnapshot.velocity < 0
      || Math.abs(reverseSnapshot.position - partialBase.position) < Math.abs(partialForward.position - partialBase.position),
    '过渡中反向滚动没有改变方向或退回原吸附点。',
  );
  await waitForDetailIdle(target);
  await assertWorkDetail(target, WORKS[0], WORKS[1]);

  for (let index = 1; index <= WORKS.length; index += 1) {
    await wheelOneWork(target, 1, index % WORKS.length);
    const expected = WORKS[index % WORKS.length];
    const following = WORKS[(index + 1) % WORKS.length];
    await assertWorkDetail(target, expected, following);
    await assertRendererContinuity(target, `第 ${index} 次滚轮吸附`);
  }

  await wheelOneWork(target, -1, WORKS.length - 1);
  await assertWorkDetail(target, WORKS[4], WORKS[0]);

  await wheelGesture(target, [180, 180, 180, 180]);
  const limitedSnapshot = await readDetailSnapshot(target);
  assert(Number.isFinite(limitedSnapshot.position) && Number.isFinite(limitedSnapshot.velocity), '快速滚动使位置或速度变成非有限值。');
  assert(Math.abs(limitedSnapshot.velocity) <= limitedSnapshot.maxVelocity + 0.0001, '快速滚动没有受 maxVelocity 限制。');
  assert(limitedSnapshot.controllerCount <= 1, '快速滚动创建了并发控制器或 timeline。');
  await waitForDetailIdle(target);
  await assertRendererContinuity(target, '快速滚动吸附');

  await wheelGesture(target, [30, 30]);
  await waitForDetailMotion(target);
  const tokenBeforeHash = (await readDetailSnapshot(target)).transitionToken;
  await target.evaluate(() => {
    window.location.hash = '#/works/glass';
  });
  await waitForDetailIdle(target);
  const afterHash = await readDetailSnapshot(target);
  assert(afterHash.transitionToken > tokenBeforeHash, '外部 hash 直达没有废弃旧过渡 token。');
  await assertWorkDetail(target, WORKS[3], WORKS[4]);

  await target.locator('[data-detail-next]').click();
  await waitForDetailIdle(target);
  await assertWorkDetail(target, WORKS[4], WORKS[0]);
  await target.goBack({ waitUntil: 'networkidle' });
  await waitForDetailIdle(target);
  assert((await target.locator('.work-detail').getAttribute('data-work-id')) === 'glass', '浏览器后退没有恢复上一个作品。');
  await target.goForward({ waitUntil: 'networkidle' });
  await waitForDetailIdle(target);
  assert((await target.locator('.work-detail').getAttribute('data-work-id')) === 'signal', '浏览器前进没有恢复下一个作品。');

  const stableHash = target.url();
  const stableSnapshot = await readDetailSnapshot(target);
  await target.locator('[data-detail-info]').click();
  await target.locator('.work-detail[data-detail-state="info"]').waitFor({ state: 'visible' });
  await waitForOverlayOpen(target, '[data-detail-info-panel]');
  const infoPlaybackStart = await target.evaluate(() => window.__FLOWFRAME_DETAIL_DEBUG__?.getRendererStats?.().current?.currentTime || 0);
  assert((await target.locator('.work-detail').getAttribute('data-renderer-paused')) === 'false', 'INFO 打开时背景渲染器仍被暂停。');
  assert((await target.locator('.work-detail').getAttribute('data-renderer-pause-reason')) === 'info-background-playing', 'INFO 没有标明背景继续播放。');
  await target.waitForFunction(
    (startTime) => (window.__FLOWFRAME_DETAIL_DEBUG__?.getRendererStats?.().current?.currentTime || 0) > startTime + 0.2,
    infoPlaybackStart,
    { timeout: 3200 },
  );
  await target.screenshot({ path: join(outputDir, 'work-detail-info-1440x900.png') });
  const infoStyle = await target.locator('[data-detail-info-panel]').evaluate((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, color: style.color };
  });
  assert(readRgbLuminance(infoStyle.background) > 0.86, 'INFO 不是暖白或白色背景。');
  assert(readRgbLuminance(infoStyle.color) < 0.25, 'INFO 没有使用深色文字。');
  const infoText = (await target.locator('[data-detail-info-panel]').textContent()) || '';
  assert(!infoText.includes('MIX DIRECTION') && !infoText.includes('FRAME NOTES'), 'INFO 仍在显示开发测试说明。');
  assert((await target.locator('[data-info-description]').textContent())?.trim().length > 40, 'INFO 缺少可读的动漫简介。');
  assert((await target.locator('[data-info-section]:visible').count()) === 2, 'INFO 没有显示人物或视觉看点。');
  const infoType = await target.evaluate(() => ({
    heading: parseFloat(getComputedStyle(document.querySelector('.work-info h2')).fontSize),
    description: parseFloat(getComputedStyle(document.querySelector('.work-info__description')).fontSize),
    body: parseFloat(getComputedStyle(document.querySelector('.work-info section p')).fontSize),
    label: parseFloat(getComputedStyle(document.querySelector('.work-info section > span')).fontSize),
  }));
  assert(infoType.heading >= 52 && infoType.description >= 18 && infoType.body >= 15 && infoType.label >= 10, 'INFO 字体仍低于桌面阅读尺寸。');
  assert((await target.locator('[data-detail-player]').getAttribute('aria-hidden')) === 'true', 'INFO 打开时播放器仍然打开。');
  await target.keyboard.press('ArrowRight');
  await wheelGesture(target, [80, 120]);
  await nextAnimationFrame(target, 2);
  assert(target.url() === stableHash, 'INFO 打开时仍能切换底层作品。');
  await assertScrollFrozen(target, stableSnapshot, 'INFO');
  await target.keyboard.press('Escape');
  await waitForDetailIdle(target);
  await target.locator('[data-detail-info-panel]').waitFor({ state: 'hidden' });

  const playBox = await target.locator('[data-detail-play]').boundingBox();
  assert(playBox, 'PLAY 圆形没有可交互边界。');
  await target.mouse.move(playBox.x + playBox.width * 0.24, playBox.y + playBox.height * 0.34);
  await target.waitForFunction(() => document.querySelector('[data-detail-play]')?.dataset.inkPhase === 'expanded');
  const inkState = await target.locator('[data-detail-play]').evaluate((button) => ({
    phase: button.dataset.inkPhase,
    origin: button.dataset.inkOrigin,
    duration: button.dataset.inkDuration,
    distortion: button.dataset.inkDistortion,
  }));
  assert(inkState.phase === 'expanded' && inkState.origin !== '50.00,50.00', 'PLAY 墨滴没有从鼠标位置扩散。');
  assert(Number(inkState.duration) > 0 && Number(inkState.distortion) > 0, 'PLAY 墨滴没有读取控制参数。');
  await target.screenshot({ path: join(outputDir, 'work-detail-play-ink-1440x900.png') });
  await target.mouse.move(40, 120);
  await target.waitForFunction(() => document.querySelector('[data-detail-play]')?.dataset.inkPhase === 'idle');
  for (let index = 0; index < 5; index += 1) {
    await target.mouse.move(playBox.x + playBox.width * 0.32, playBox.y + playBox.height * 0.42);
    await target.waitForTimeout(18);
    await target.mouse.move(40 + index, 120);
    await target.waitForTimeout(18);
  }
  await target.waitForFunction(() => document.querySelector('[data-detail-play]')?.dataset.inkPhase === 'idle');
  const retractedInk = await target.locator('[data-detail-play]').evaluate((button) => {
    const ink = button.querySelector('.work-play__ink');
    const style = ink ? getComputedStyle(ink) : null;
    const transform = style?.transform || 'none';
    let scale = 0;
    if (transform !== 'none') {
      const matrix = new DOMMatrixReadOnly(transform);
      scale = Math.hypot(matrix.m11, matrix.m12);
    }
    return {
      phase: button.dataset.inkPhase,
      opacity: Number(style?.opacity ?? 0),
      visibility: style?.visibility || 'hidden',
      transform,
      scale,
    };
  });
  assert(retractedInk.phase === 'idle', `PLAY 快速移入移出后没有回到 idle：${JSON.stringify(retractedInk)}`);
  assert(
    retractedInk.opacity <= 0.01 || retractedInk.visibility === 'hidden' || retractedInk.scale <= 0.02,
    `PLAY 墨滴回收后仍残留黑点：${JSON.stringify(retractedInk)}`,
  );

  await target.locator('[data-detail-play]').click();
  await target.locator('.work-detail[data-detail-state="playing"]').waitFor({ state: 'visible' });
  assert((await target.locator('[data-detail-info-panel]').getAttribute('aria-hidden')) === 'true', 'PLAY 打开时 INFO 没有关闭。');
  await target.locator('.work-player-wipe').waitFor({ state: 'hidden' });
  assert(await target.locator('[data-detail-player-close]').isVisible(), '播放器没有显示 BACK。');
  const playerVideo = target.locator('[data-detail-player-video]');
  await target.waitForFunction(() => {
    const video = document.querySelector('[data-detail-player-video]');
    return video && video.readyState >= 2 && !video.paused;
  });
  await target.screenshot({ path: join(outputDir, 'work-detail-player-1440x900.png') });
  const playerTimeA = await playerVideo.evaluate((video) => video.currentTime);
  await target.waitForFunction(
    (startTime) => document.querySelector('[data-detail-player-video]')?.currentTime > startTime + 0.25,
    playerTimeA,
  );
  await target.keyboard.press('ArrowRight');
  await wheelGesture(target, [80, 120]);
  await nextAnimationFrame(target, 2);
  assert(target.url() === stableHash, 'PLAY 打开时仍能切换底层作品。');
  await assertScrollFrozen(target, stableSnapshot, 'PLAY');
  await target.keyboard.press('Escape');
  await waitForDetailIdle(target);
  assert(await playerVideo.evaluate((video) => video.paused), 'Escape 关闭播放器后视频没有暂停。');

  await target.reload({ waitUntil: 'networkidle' });
  await waitForDetailIdle(target);
  assert((await target.locator('.work-detail').getAttribute('data-work-id')) === 'signal', '刷新后没有恢复 hash 对应作品。');
  assert((await target.locator('[data-detail-info-panel]').getAttribute('aria-hidden')) === 'true', '刷新后 INFO 状态没有复位。');
  assert((await target.locator('[data-detail-player]').getAttribute('aria-hidden')) === 'true', '刷新后 PLAY 状态没有复位。');

  await target.goto(`${targetUrl}#/works/not-a-work`, { waitUntil: 'networkidle' });
  await waitForDetailIdle(target);
  assert(target.url().endsWith('#/works/afterglow'), '无效作品 ID 没有归一到第一项。');
  await target.goto(`${targetUrl}#/works/afterglow/extra`, { waitUntil: 'networkidle' });
  await target.locator('.ff-home').waitFor({ state: 'visible' });
  assert(target.url().endsWith('#/'), '尾随路径没有归一到首页。');
  await target.evaluate(() => {
    window.location.hash = '#/works/%E0%A4%A';
  });
  await waitForDetailIdle(target);
  assert(target.url().endsWith('#/works/afterglow'), '错误编码的作品 hash 没有安全归一。');

  for (const viewport of [
    { width: 1280, height: 720, file: 'work-detail-1280x720.png' },
    { width: 1920, height: 1080, file: 'work-detail-1920x1080.png' },
  ]) {
    await target.setViewportSize({ width: viewport.width, height: viewport.height });
    await target.goto(`${targetUrl}#/works/afterglow`, { waitUntil: 'networkidle' });
    await waitForDetailIdle(target);
    await assertDetailLayout(target, viewport);
    const shot = await target.screenshot({ path: join(outputDir, viewport.file) });
    assertDetailImageHasRange(shot, `作品详情 ${viewport.width}×${viewport.height}`);
    await wheelGesture(target, [26, 26]);
    await waitForDetailMotion(target);
    await assertDetailLayout(target, viewport);
    await assertRendererContinuity(target, `作品详情 ${viewport.width}×${viewport.height} 中间帧`);
    const partialViewportShot = await target.screenshot({
      path: join(outputDir, `work-detail-scroll-partial-${viewport.width}x${viewport.height}.png`),
    });
    assertDetailImageHasRange(partialViewportShot, `作品详情 ${viewport.width}×${viewport.height} 中间帧`);
    await wheelGesture(target, [-34, -34, -24]);
    await waitForDetailIdle(target);
  }

  await verifyWebGLFallback(target);

  await target.setViewportSize(REFERENCE_VIEWPORT);
  await target.goto(`${targetUrl}#/works/tide`, { waitUntil: 'networkidle' });
  await waitForDetailIdle(target);
  await target.keyboard.press('Escape');
  await target.locator('.ff-home').waitFor({ state: 'visible' });
  assert(target.url().endsWith('#/'), '详情 idle 状态按 Escape 没有返回首页。');
}

async function verifyWebGLFallback(target) {
  await target.setViewportSize(DETAIL_REFERENCE_VIEWPORT);
  await target.goto(`${targetUrl}#/works/afterglow`, { waitUntil: 'networkidle' });
  await waitForDetailIdle(target);
  const canLoseContext = await target.locator('.work-visual-stage canvas').evaluate((canvas) => {
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    canvas.__flowframeContextLossExtension = extension;
    extension.loseContext();
    return true;
  });
  assert(canLoseContext, '真实浏览器不支持 WEBGL_lose_context，无法验证详情回退。');
  await target.waitForFunction(() => {
    const stats = window.__FLOWFRAME_DETAIL_DEBUG__?.getRendererStats?.() || {};
    return stats.fallback === true
      || stats.contextLost === true
      || document.querySelector('[data-detail-render-fallback="true"]');
  });
  const fallbackShot = await target.screenshot({ path: join(outputDir, 'work-detail-webgl-fallback-1440x900.png') });
  assertDetailImageHasRange(fallbackShot, 'WebGL 上下文丢失回退画面', { allowDark: true });
  assert(await target.locator('[data-detail-title]').isVisible(), 'WebGL 回退时标题不可读。');
  assert(await target.locator('[data-detail-play]').isVisible(), 'WebGL 回退时 PLAY 不可用。');

  await target.locator('.work-visual-stage canvas').evaluate((canvas) => {
    canvas.__flowframeContextLossExtension?.restoreContext();
    delete canvas.__flowframeContextLossExtension;
  });
  await target.waitForFunction(() => {
    const stats = window.__FLOWFRAME_DETAIL_DEBUG__?.getRendererStats?.() || {};
    return stats.mode === 'webgl'
      && stats.contextLost !== true
      && stats.current?.ready === true
      && stats.next?.ready === true;
  }, undefined, { timeout: 6000 });
  await assertWorkDetail(target, WORKS[0], WORKS[1]);
}

async function verifyReducedMotionDetail(browserInstance) {
  const target = await browserInstance.newPage({
    viewport: DETAIL_REFERENCE_VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  attachPageDiagnostics(target, 'reduced-motion');

  try {
    await target.goto(`${targetUrl}#/works/afterglow`, { waitUntil: 'networkidle' });
    await waitForDetailIdle(target);
    assert(
      await target.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      'reduced-motion 页面没有启用 reduce 媒体查询。',
    );
    await wheelGesture(target, [150]);
    await nextAnimationFrame(target, 2);
    const reducedSnapshot = await readDetailSnapshot(target);
    assert(reducedSnapshot.reducedMotion === true, 'reduced-motion 没有传入连续滚动控制器和渲染器。');
    assert(reducedSnapshot.isSettled === true, 'reduced-motion 滚轮后没有立即落到稳定作品。');
    assert(reducedSnapshot.settledIndex === 1, 'reduced-motion 滚轮没有进入下一作品。');
    await waitForDetailIdle(target);
    await assertWorkDetail(target, WORKS[1], WORKS[2]);
    const runningLongAnimations = await target.evaluate(() => document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming?.();
      return animation.playState === 'running' && Number(timing?.duration || 0) > 100;
    }).length);
    assert(runningLongAnimations === 0, 'reduced-motion 吸附后仍有长动画运行。');
    const shot = await target.screenshot({ path: join(outputDir, 'work-detail-reduced-motion-1440x900.png') });
    assertDetailImageHasRange(shot, 'reduced-motion 作品详情', { allowLight: true });

    const frozen = await readDetailSnapshot(target);
    await target.locator('[data-detail-info]').click();
    await target.locator('.work-detail[data-detail-state="info"]').waitFor({ state: 'visible' });
    await wheelGesture(target, [120, 120]);
    await nextAnimationFrame(target, 2);
    await assertScrollFrozen(target, frozen, 'reduced-motion INFO');
    await target.keyboard.press('Escape');
    await waitForDetailIdle(target);
  } finally {
    await target.close();
  }
}

async function verifyDesktopGuard(target) {
  await target.setViewportSize({ width: 1100, height: 800 });
  await target.goto(`${targetUrl}#/`, { waitUntil: 'networkidle' });
  const guardState = await target.locator('#desktopGuard').evaluate((node) => ({
    hidden: node.getAttribute('aria-hidden'),
    display: getComputedStyle(node).display,
  }));
  assert(
    guardState.hidden === 'false' && guardState.display === 'grid',
    '窄窗口没有显示电脑端提示。',
  );
  await target.screenshot({ path: join(outputDir, 'desktop-guard-1100x800.png') });
}

function attachPageDiagnostics(target, label) {
  target.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
  });
  target.on('pageerror', (error) => errors.push(`${label} page: ${error.message}`));
  target.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown request failure';
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure)) return;
    errors.push(`${label} requestfailed: ${request.resourceType()} ${request.url()} (${failure})`);
  });
  target.addInitScript(() => {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
      console.error(`UNHANDLED PROMISE: ${reason}`);
    });
  });
}

async function readDetailSnapshot(target) {
  return target.evaluate(() => {
    const detail = document.querySelector('.work-detail');
    if (!detail) throw new Error('详情根节点不存在。');
    const debug = window.__FLOWFRAME_DETAIL_DEBUG__;
    const raw = debug?.getSnapshot?.() || {};
    const renderer = debug?.getRendererStats?.() || {};
    const number = (...values) => {
      for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return Number.NaN;
    };
    const boolean = (...values) => {
      for (const value of values) {
        if (typeof value === 'boolean') return value;
        if (value === 'true') return true;
        if (value === 'false') return false;
      }
      return undefined;
    };
    const detailState = raw.detailState || detail.dataset.detailState || '';
    const scrollState = raw.scrollState
      || detail.dataset.scrollState
      || (raw.motionKind === 'idle' || raw.isSettled ? 'idle' : 'switching');
    const settledIndex = number(raw.settledIndex, raw.currentIndex, raw.activeIndex, detail.dataset.activeIndex);
    const semanticIndex = number(raw.semanticIndex, raw.dominantIndex, raw.activeIndex, detail.dataset.activeIndex);
    const activeIndex = number(raw.activeIndex, semanticIndex, detail.dataset.activeIndex);
    const targetIndex = number(raw.targetIndex, raw.toIndex, detail.dataset.targetIndex);
    const progress = number(raw.progress, detail.dataset.scrollProgress);
    const velocity = number(raw.velocity, detail.dataset.scrollVelocity);
    const position = number(raw.position, detail.dataset.scrollPosition);
    const isSettled = boolean(raw.isSettled, detail.dataset.isSettled, scrollState === 'idle' && detailState === 'idle');
    const derivedTextureCount = [renderer.current, renderer.next]
      .filter((slot) => slot?.ready)
      .length;
    const textureCount = number(
      renderer.textureCount,
      renderer.activeTextureCount,
      raw.textureCount,
      detail.dataset.textureCount,
      derivedTextureCount,
    );
    return {
      detailState,
      scrollState,
      position,
      velocity,
      settledIndex,
      semanticIndex,
      activeIndex,
      targetIndex,
      fromIndex: number(raw.fromIndex, raw.currentIndex, renderer.fromIndex),
      toIndex: number(raw.toIndex, renderer.toIndex, targetIndex),
      progress,
      direction: number(raw.direction, detail.dataset.scrollDirection, 0),
      isSettled,
      transitionToken: number(raw.transitionToken, renderer.pairToken, detail.dataset.transitionToken, 0),
      maxVelocity: number(raw.maxVelocity, raw.physics?.maxVelocity, detail.dataset.maxVelocity, 4),
      controllerCount: number(
        raw.controllerCount,
        raw.activeControllerCount,
        raw.activeTimelineCount,
        detail.dataset.controllerCount,
        detailState === 'switching' ? 1 : 0,
      ),
      rendererMode: renderer.mode || raw.rendererMode || detail.dataset.rendererMode || '',
      textureCount,
      readyTextureCount: number(renderer.readyTextureCount, raw.readyTextureCount, textureCount),
      rendererCurrentId: renderer.current?.id || raw.rendererCurrentId || detail.dataset.rendererCurrentId || '',
      rendererNextId: renderer.next?.id || raw.rendererNextId || detail.dataset.rendererNextId || '',
      reducedMotion: boolean(raw.reducedMotion, renderer.reducedMotion, detail.dataset.reducedMotion),
    };
  });
}

async function readRendererStats(target) {
  const renderer = await target.evaluate(() => window.__FLOWFRAME_DETAIL_DEBUG__?.getRendererStats?.() || {});
  const snapshot = await readDetailSnapshot(target);
  return {
    ...renderer,
    mode: renderer.mode || snapshot.rendererMode,
    textureCount: renderer.textureCount ?? snapshot.textureCount,
    readyTextureCount: renderer.readyTextureCount ?? snapshot.readyTextureCount,
    fromIndex: renderer.fromIndex ?? snapshot.fromIndex,
    toIndex: renderer.toIndex ?? snapshot.toIndex,
    currentId: renderer.current?.id || snapshot.rendererCurrentId,
    nextId: renderer.next?.id || snapshot.rendererNextId,
  };
}

async function assertContinuousDetailContract(target) {
  const snapshot = await readDetailSnapshot(target);
  assert((await target.locator('.work-visual-stage canvas').count()) === 1, '详情页必须只有一个 WebGL Canvas。');
  assert(/webgl/i.test(snapshot.rendererMode), '详情渲染器没有公开 WebGL renderer mode。');
  assert(Number.isFinite(snapshot.position), '详情调试快照缺少有限 position。');
  assert(Number.isFinite(snapshot.velocity), '详情调试快照缺少有限 velocity。');
  assert(Number.isFinite(snapshot.progress) && snapshot.progress >= 0 && snapshot.progress <= 1, '详情调试快照缺少 0..1 progress。');
  assert(Number.isInteger(snapshot.settledIndex), '详情调试快照缺少 settledIndex。');
  assert(Number.isInteger(snapshot.semanticIndex), '详情调试快照缺少 semanticIndex。');
  assert(snapshot.isSettled === true, '详情初始 idle 状态没有精确吸附。');
  assert(snapshot.textureCount >= 1 && snapshot.textureCount <= 2, '详情活动纹理数不在 current/next 范围内。');
}

async function assertRendererContinuity(target, label) {
  const snapshot = await readDetailSnapshot(target);
  const canvasState = await target.locator('.work-visual-stage canvas').evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
  }));
  assert(canvasState.width > 0 && canvasState.height > 0, `${label}：Canvas 绘制尺寸为 0。`);
  assert(canvasState.clientWidth > 0 && canvasState.clientHeight > 0, `${label}：Canvas 可见尺寸为 0。`);
  assert(/webgl/i.test(snapshot.rendererMode), `${label}：渲染器不是 WebGL。`);
  assert(snapshot.textureCount >= 1 && snapshot.textureCount <= 2, `${label}：活动纹理数超过 current/next。`);
  assert(snapshot.readyTextureCount >= 1, `${label}：当前和下一纹理都不可读。`);
  assert(Number.isFinite(snapshot.progress) && snapshot.progress >= 0 && snapshot.progress <= 1, `${label}：Shader 进度非法。`);
  assert(Number.isFinite(snapshot.position) && Number.isFinite(snapshot.velocity), `${label}：滚动物理出现非有限值。`);
}

async function nextAnimationFrame(target, count = 1) {
  for (let index = 0; index < count; index += 1) {
    await target.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => resolveFrame())));
  }
}

async function wheelGesture(target, deltas) {
  const viewport = target.viewportSize();
  if (!viewport) throw new Error('滚轮测试缺少视口尺寸。');
  await target.mouse.move(viewport.width * 0.5, viewport.height * 0.5);
  for (const delta of deltas) {
    await target.mouse.wheel(0, delta);
    await nextAnimationFrame(target);
  }
}

async function wheelOneWork(target, direction, expectedIndex) {
  const delta = direction < 0 ? -1 : 1;
  let reachedTarget = false;
  for (let attempt = 0; attempt < 4 && !reachedTarget; attempt += 1) {
    await wheelGesture(target, [delta * 150, delta * 130]);
    reachedTarget = await target.waitForFunction((targetIndex) => {
      const detail = document.querySelector('.work-detail');
      const raw = window.__FLOWFRAME_DETAIL_DEBUG__?.getSnapshot?.() || {};
      const semantic = Number(
        raw.semanticIndex
        ?? raw.dominantIndex
        ?? raw.activeIndex
        ?? raw.currentIndex
        ?? detail?.dataset.activeIndex,
      );
      const target = Number(raw.targetIndex ?? raw.toIndex ?? detail?.dataset.targetIndex);
      return semantic === targetIndex || target === targetIndex;
    }, expectedIndex, { timeout: 900 }).then(() => true).catch(() => false);
  }
  assert(reachedTarget, `真实滚轮手势没有推进到作品索引 ${expectedIndex}。`);
  await waitForDetailIdle(target);
  const settled = await readDetailSnapshot(target);
  assert(settled.settledIndex === expectedIndex, `滚轮停止后没有唯一吸附到作品索引 ${expectedIndex}。`);
  assert(settled.semanticIndex === expectedIndex, `吸附后语义作品不是索引 ${expectedIndex}。`);
  assert(Math.abs(settled.velocity) <= 0.001, '吸附完成后 velocity 没有归零。');
  assert(settled.isSettled === true, '滚轮停止后 isSettled 仍为 false。');
}

async function waitForDetailMotion(target) {
  await target.waitForFunction(() => {
    const detail = document.querySelector('.work-detail');
    const raw = window.__FLOWFRAME_DETAIL_DEBUG__?.getSnapshot?.() || {};
    const detailState = raw.detailState || detail?.dataset.detailState;
    const scrollState = raw.scrollState
      || detail?.dataset.scrollState
      || (raw.motionKind === 'idle' || raw.isSettled ? 'idle' : 'switching');
    const progress = Number(raw.progress ?? detail?.dataset.scrollProgress);
    const settled = raw.isSettled ?? detail?.dataset.isSettled === 'true';
    return detailState === 'switching'
      && scrollState !== 'idle'
      && settled !== true
      && Number.isFinite(progress)
      && progress > 0.001
      && progress < 0.999;
  }, undefined, { timeout: 3000 });
}

async function waitForDetailReverse(target, forwardPosition) {
  await target.waitForFunction((positionBeforeReverse) => {
    const detail = document.querySelector('.work-detail');
    const raw = window.__FLOWFRAME_DETAIL_DEBUG__?.getSnapshot?.() || {};
    const position = Number(raw.position ?? detail?.dataset.scrollPosition);
    const velocity = Number(raw.velocity ?? detail?.dataset.scrollVelocity);
    const direction = Number(raw.direction ?? detail?.dataset.scrollDirection);
    return direction < 0 || velocity < 0 || position < positionBeforeReverse;
  }, forwardPosition, { timeout: 3000 });
}

async function waitForOverlayOpen(target, selector) {
  await target.waitForFunction((panelSelector) => {
    const panel = document.querySelector(panelSelector);
    if (!panel || panel.getAttribute('aria-hidden') !== 'false') return false;
    const style = getComputedStyle(panel);
    return style.visibility !== 'hidden' && Number(style.opacity) > 0.95;
  }, selector);
}

async function assertScrollFrozen(target, before, label) {
  const after = await readDetailSnapshot(target);
  assert(Math.abs(after.position - before.position) <= 0.001, `${label} 打开时底层 position 仍在变化。`);
  assert(Math.abs(after.velocity) <= 0.001, `${label} 打开时底层 velocity 没有冻结。`);
  assert(after.settledIndex === before.settledIndex, `${label} 打开时底层作品发生切换。`);
  assert(after.semanticIndex === before.semanticIndex, `${label} 打开时底层语义作品发生切换。`);
}

async function readPointer(target) {
  return target.locator('.ff-home').evaluate((node) => ({
    x: getComputedStyle(node).getPropertyValue('--pointer-x').trim(),
    y: getComputedStyle(node).getPropertyValue('--pointer-y').trim(),
  }));
}

async function assertBgmTrack(target, work, { expectPlaying = false } = {}) {
  await target.waitForFunction(({ id, audioPath, shouldPlay }) => {
    const audio = document.querySelector('audio[data-flowframe-bgm]');
    if (!audio || audio.dataset.flowframeBgmTrack !== id) return false;
    if (!audioPath) {
      return !audio.hasAttribute('src')
        && audio.paused
        && document.body.dataset.bgmState === 'missing';
    }
    const pathname = new URL(audio.currentSrc || audio.src, window.location.href).pathname;
    return pathname.endsWith(audioPath)
      && (!shouldPlay || (audio.readyState >= 2 && !audio.paused));
  }, {
    id: work.id,
    audioPath: work.audio,
    shouldPlay: expectPlaying,
  }, { timeout: 6000 });

  const state = await target.locator('audio[data-flowframe-bgm]').evaluate((audio) => ({
    track: audio.dataset.flowframeBgmTrack,
    source: audio.currentSrc || audio.src,
    paused: audio.paused,
    bodyState: document.body.dataset.bgmState,
  }));
  assert(state.track === work.id, `BGM 没有切换到作品 ${work.id}。`);
  if (work.audio) {
    assert(new URL(state.source).pathname.endsWith(work.audio), `作品 ${work.id} 使用了错误 BGM。`);
    if (expectPlaying) assert(!state.paused, `作品 ${work.id} 的 BGM 没有继续播放。`);
  } else {
    assert(state.paused && state.bodyState === 'missing', `缺少 BGM 的作品 ${work.id} 仍在播放上一作品音轨。`);
  }
}

async function waitForDetailIdle(target) {
  await target.waitForFunction(() => {
    const detail = document.querySelector('.work-detail');
    if (!detail) return false;
    const raw = window.__FLOWFRAME_DETAIL_DEBUG__?.getSnapshot?.() || {};
    const detailState = raw.detailState || detail.dataset.detailState;
    const scrollState = raw.scrollState
      || detail.dataset.scrollState
      || (raw.motionKind === 'idle' || raw.isSettled ? 'idle' : 'switching');
    const velocity = Number(raw.velocity ?? detail.dataset.scrollVelocity);
    const isSettled = raw.isSettled ?? detail.dataset.isSettled === 'true';
    return detailState === 'idle'
      && document.querySelector('.work-player-wipe')?.hidden !== false
      && (scrollState === 'idle' || isSettled === true)
      && isSettled === true
      && Number.isFinite(velocity)
      && Math.abs(velocity) <= 0.001;
  }, undefined, { timeout: 8000 });
}

async function waitForRendererPair(target, expectedWork, expectedNextWork) {
  const expectedIndex = WORKS.findIndex((work) => work.id === expectedWork.id);
  const expectedNextIndex = WORKS.findIndex((work) => work.id === expectedNextWork.id);
  await target.waitForFunction(({ currentId, nextId, currentIndex, nextIndex }) => {
    const detail = document.querySelector('.work-detail');
    const renderer = window.__FLOWFRAME_DETAIL_DEBUG__?.getRendererStats?.() || {};
    if (renderer.current || renderer.next) {
      return renderer.current?.id === currentId
        && renderer.next?.id === nextId
        && renderer.current?.ready === true
        && renderer.next?.ready === true;
    }
    return Number(detail?.dataset.activeIndex) === currentIndex
      && Number(detail?.dataset.targetIndex) === nextIndex
      && Number(detail?.dataset.textureCount) >= 1;
  }, {
    currentId: expectedWork.id,
    nextId: expectedNextWork.id,
    currentIndex: expectedIndex,
    nextIndex: expectedNextIndex,
  }, { timeout: 6000 });
}

async function assertWorkDetail(target, expectedWork, expectedNextWork) {
  const detail = target.locator('.work-detail');
  assert((await detail.getAttribute('data-work-id')) === expectedWork.id, `详情作品不是 ${expectedWork.id}。`);
  assert((await target.locator('[data-detail-title]').textContent())?.trim() === expectedWork.title, `详情标题不是 ${expectedWork.title}。`);
  assert(target.url().endsWith(`#/works/${expectedWork.id}`), `详情 hash 没有同步到 ${expectedWork.id}。`);
  assert((await target.locator('.work-visual-stage canvas').count()) === 1, '详情页没有恰好一个 WebGL Canvas。');
  assert(await target.locator('[data-detail-asset]').isVisible(), '详情画面没有显示 PLACEHOLDER MEDIA。');
  assert((await target.locator('.work-detail').getAttribute('data-detail-state')) === 'idle', '详情没有稳定在 idle。');
  await waitForRendererPair(target, expectedWork, expectedNextWork);
  const renderer = await readRendererStats(target);
  assert(renderer.current?.kind === 'video', `详情 ${expectedWork.id} 没有加载视频纹理。`);
  const currentPath = new URL(renderer.current?.source || '', target.url()).pathname;
  assert(
    expectedWork.videos.some((video) => currentPath.endsWith(video)),
    `详情 ${expectedWork.id} 加载了不属于该主题的视频。`,
  );
  assert(renderer.current?.playlistLength === expectedWork.videos.length, `详情 ${expectedWork.id} 没有加载完整片段列表。`);
  assert(renderer.next?.kind === 'video', `详情 ${expectedWork.id} 没有只预载下一作品视频。`);
  const nextPath = new URL(renderer.next?.source || '', target.url()).pathname;
  assert(
    expectedNextWork.videos.some((video) => nextPath.endsWith(video)),
    `详情 ${expectedWork.id} 预载了错误的下一主题视频。`,
  );
  assert(renderer.next?.playlistLength === expectedNextWork.videos.length, `详情 ${expectedWork.id} 没有预载下一主题的完整片段列表。`);
  const expectedIndex = WORKS.findIndex((work) => work.id === expectedWork.id);
  const expectedNextIndex = WORKS.findIndex((work) => work.id === expectedNextWork.id);
  const snapshot = await readDetailSnapshot(target);
  assert(snapshot.isSettled === true, '详情 idle 时没有精确吸附。');
  assert(snapshot.settledIndex === expectedIndex, `详情 settledIndex 不是 ${expectedIndex}。`);
  assert(snapshot.semanticIndex === expectedIndex, `详情 semanticIndex 不是 ${expectedIndex}。`);
  assert(
    snapshot.rendererCurrentId === expectedWork.id || snapshot.fromIndex === expectedIndex,
    '当前 Shader 纹理和作品不一致。',
  );
  assert(
    snapshot.rendererNextId === expectedNextWork.id || snapshot.toIndex === expectedNextIndex,
    '下一 Shader 纹理没有预载后续作品。',
  );
  await assertRendererContinuity(target, `详情 ${expectedWork.id}`);
}

async function assertBackgroundPlaylistAdvances(target, expectedWork) {
  const before = await readRendererStats(target);
  assert(before.current?.playlistLength === expectedWork.videos.length, '背景没有加载完整多片段列表。');
  const previousIndex = Number(before.current?.sourceIndex || 0);
  await target.waitForFunction(({ workId, oldIndex, expectedPaths }) => {
    const renderer = window.__FLOWFRAME_DETAIL_DEBUG__?.getRendererStats?.() || {};
    const current = renderer.current;
    if (current?.id !== workId || Number(current.sourceIndex) === oldIndex) return false;
    const pathname = new URL(current.source || '', window.location.href).pathname;
    return expectedPaths.some((path) => pathname.endsWith(path));
  }, {
    workId: expectedWork.id,
    oldIndex: previousIndex,
    expectedPaths: expectedWork.videos,
  }, { timeout: 9000 });
}

async function assertPlayerPlayback(target, expectedWork) {
  await target.locator('[data-detail-play]').click();
  await target.locator('.work-detail[data-detail-state="playing"]').waitFor({ state: 'visible' });
  await target.locator('.work-player-wipe').waitFor({ state: 'hidden' });
  await target.waitForFunction(() => {
    const video = document.querySelector('[data-detail-player-video]');
    if (!video) return false;
    const pathname = new URL(video.currentSrc || video.src, window.location.href).pathname;
    return video.readyState >= 2
      && !video.paused
      && pathname.endsWith('/playback.mp4')
      && video.duration > 60;
  }, undefined, { timeout: 15000 });
  const playerState = await target.locator('[data-detail-player-video]').evaluate((video) => ({
    src: video.currentSrc,
    loop: video.loop,
    controls: video.controls,
    width: video.getBoundingClientRect().width,
    height: video.getBoundingClientRect().height,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
  }));
  assert(!playerState.loop && !playerState.controls, '完整视频不应循环或使用默认播放器控件。');
  assert(playerState.width === playerState.viewportWidth && playerState.height === playerState.viewportHeight, '播放器没有铺满视口。');
  assert(await target.locator('audio[data-flowframe-bgm]').evaluate((audio) => audio.paused), '完整视频与背景音乐同时播放。');
  assert(await target.locator('[data-detail-player]').getAttribute('data-controls') === 'hidden', '进入后控件没有默认隐藏。');
  const startTime = await target.locator('[data-detail-player-video]').evaluate((video) => video.currentTime);
  await target.waitForFunction(
    (time) => document.querySelector('[data-detail-player-video]')?.currentTime > time + 0.2,
    startTime,
    { timeout: 3000 },
  );
  await target.locator('[data-detail-player-video]').evaluate((video) => video.dispatchEvent(new Event('ended')));
  assert(await target.locator('[data-detail-player-video]').evaluate((video) => video.currentSrc) === playerState.src, '完整视频结束时错误切到碎片预览。');
  await target.locator('[data-player-toggle]').click();
  assert(await target.locator('[data-detail-player-video]').evaluate((video) => video.paused), '暂停按钮无效。');
  await target.locator('[data-player-progress]').fill('50');
  await target.waitForFunction(() => {
    const video = document.querySelector('[data-detail-player-video]');
    return Math.abs(video.currentTime / video.duration - 0.5) < 0.02;
  });
  await target.locator('[data-player-volume]').fill('0.3');
  assert(await target.locator('[data-detail-player-video]').evaluate((video) => Math.abs(video.volume - 0.3) < 0.01), '音量滑条无效。');
  await target.locator('[data-detail-player-close]').click();
  await waitForDetailIdle(target);
  const returnedPlay = await target.locator('[data-detail-play]').evaluate((button) => ({
    phase: button.dataset.inkPhase,
    inkOpacity: Number(getComputedStyle(button.querySelector('.work-play__ink')).opacity),
    animation: getComputedStyle(button).animationName,
  }));
  assert(returnedPlay.phase === 'idle' && returnedPlay.inkOpacity === 0 && returnedPlay.animation === 'none',
    `BACK 后 PLAY 没有直接恢复白色：${JSON.stringify(returnedPlay)}`);
  assert(
    await target.locator('[data-detail-player-video]').evaluate((video) => video.paused),
    `作品 ${expectedWork.id} 播放器关闭后仍在播放。`,
  );
}

async function assertDetailLayout(target, viewport) {
  const stage = await target.locator('.work-visual-stage').boundingBox();
  const copy = await target.locator('.work-copy').boundingBox();
  const play = await target.locator('[data-detail-play]').boundingBox();
  const navigation = await target.locator('.work-navi').boundingBox();
  assert(stage && stage.width >= viewport.width - 1 && stage.height >= viewport.height - 1, '详情媒体没有铺满视口。');
  assert(copy && copy.x >= 170 && copy.x + copy.width <= viewport.width - 170, '详情文案容器没有保持居中安全区。');
  assert(play && play.width >= 149 && play.width <= 165 && Math.abs(play.width - play.height) < 1, 'PLAY 圆尺寸不在 150–164px 范围。');
  assert(play.x > viewport.width * 0.62, 'PLAY 没有位于正文右侧。');
  assert(navigation && navigation.y + navigation.height <= viewport.height - 20, '底部导航超出视口。');
  const detailType = await target.evaluate(() => ({
    title: parseFloat(getComputedStyle(document.querySelector('.work-copy h1')).fontSize),
    logline: parseFloat(getComputedStyle(document.querySelector('.work-logline')).fontSize),
    info: parseFloat(getComputedStyle(document.querySelector('.work-info-button')).fontSize),
    navTitle: parseFloat(getComputedStyle(document.querySelector('.work-navi__item strong')).fontSize),
    count: parseFloat(getComputedStyle(document.querySelector('.work-navi__count')).fontSize),
  }));
  assert(detailType.title >= 52 && detailType.logline >= 14 && detailType.info >= 13, '详情核心文字没有达到视觉重点尺寸。');
  assert(detailType.navTitle >= 15 && detailType.count >= 9.5, '详情边角导航字体仍然过小。');
  const overflow = await target.evaluate(() => ({
    width: document.documentElement.scrollWidth - window.innerWidth,
    height: document.documentElement.scrollHeight - window.innerHeight,
  }));
  assert(overflow.width <= 1 && overflow.height <= 1, '详情页出现了不需要的滚动区域。');
}

function readRgbLuminance(color) {
  const values = String(color).match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0, 0, 0];
  return values.reduce((sum, value) => sum + value, 0) / (3 * 255);
}

function assertDetailImageHasRange(buffer, label, { allowDark = false, allowLight = false } = {}) {
  const image = PNG.sync.read(buffer);
  let dark = 0;
  let mid = 0;
  let varied = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index];
    const green = image.data[index + 1];
    const blue = image.data[index + 2];
    const luminance = (red + green + blue) / 3;
    if (luminance < 72) dark += 1;
    if (luminance >= 72 && luminance <= 220) mid += 1;
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 12) varied += 1;
  }
  const pixels = image.width * image.height;
  assert(dark / pixels > (allowLight ? 0.002 : 0.015), `${label} 缺少文字或暗部层次。`);
  assert(mid / pixels > (allowDark ? 0.015 : 0.05), `${label} 疑似空白或曝光异常。`);
  assert(varied / pixels > 0.02, `${label} 缺少有效影像色彩。`);
}

async function waitForTransitionToFinish(target) {
  await target.locator('.tx-experience.is-transitioning').waitFor({ state: 'visible' });
  await target.locator('.tx-experience.is-transitioning').waitFor({ state: 'detached', timeout: 5000 });
}

async function assertActiveVideoReady(target, expectedFile) {
  const state = await target.locator('.tx-media-layer--current video').evaluate((video) => ({
    currentSrc: video.currentSrc,
    readyState: video.readyState,
  }));
  assert(state.currentSrc.endsWith(expectedFile), `当前视频不是 ${expectedFile}。`);
  assert(state.readyState >= 2, `视频 ${expectedFile} 没有加载到可播放状态。`);
}

async function assertTransitionMotion(target) {
  const state = await target.evaluate(() => {
    const incoming = document.querySelector('.tx-media-layer--incoming');
    const outgoing = document.querySelector('.tx-media-layer--outgoing');
    const slice = document.querySelector('.tx-slice');
    const incomingFrames = incoming?.getAnimations()[0]?.effect?.getKeyframes?.() || [];
    const outgoingFrames = outgoing?.getAnimations()[0]?.effect?.getKeyframes?.() || [];
    return {
      incomingFrames,
      outgoingFrames,
      sliceAnimations: slice?.getAnimations().length || 0,
    };
  });

  const incomingText = JSON.stringify(state.incomingFrames);
  const outgoingText = JSON.stringify(state.outgoingFrames);
  assert(incomingText.includes('polygon'), '转场缺少斜向遮罩。');
  assert(incomingText.includes('scale') && outgoingText.includes('translate3d'), '转场缺少缩放或移动。');
  assert(incomingText.includes('blur') && outgoingText.includes('skewX'), '转场缺少模糊或轻微扭曲。');
  assert(state.sliceAnimations > 0, '转场切面动画没有运行。');
}

function assertImageHasDetail(buffer, label) {
  const image = PNG.sync.read(buffer);
  let varied = 0;
  let dark = 0;
  let light = 0;

  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index];
    const green = image.data[index + 1];
    const blue = image.data[index + 2];
    const luminance = (red + green + blue) / 3;
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 18) varied += 1;
    if (luminance < 70) dark += 1;
    if (luminance > 205) light += 1;
  }

  const pixels = image.width * image.height;
  assert(varied / pixels > 0.025, `${label}截图缺少有效画面细节。`);
  assert(dark / pixels > 0.005 && light / pixels > 0.2, `${label}截图疑似空白或曝光异常。`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
