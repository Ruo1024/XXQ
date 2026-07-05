import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const targetUrl = process.env.TARGET_URL || 'http://127.0.0.1:5173/';
const currentDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(currentDir, '../output/playwright');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  await verifyViewport({ name: 'desktop', width: 1440, height: 900, clickCover: true });
  await verifyViewport({ name: 'mobile', width: 390, height: 844, focusButton: true });
} finally {
  await browser.close();
}

async function verifyViewport({ name, width, height, clickCover, focusButton }) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: name === 'mobile' ? 2 : 1,
  });

  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.galleryExperience?.coverMeshes?.length === 6);
  await page.waitForTimeout(900);

  const screenshot = await page.screenshot({
    path: join(outputDir, `${name}.png`),
    fullPage: false,
  });
  const screenshotStats = analyzeScreenshot(screenshot);

  if (screenshotStats.litRatio < 0.08 || screenshotStats.variedRatio < 0.02) {
    throw new Error(`${name} screenshot appears blank: ${JSON.stringify(screenshotStats)}`);
  }

  if (clickCover) {
    await assertCoverFraming(page);
    await assertSkipRoute(page);

    const point = await page.evaluate(() => {
      const app = window.galleryExperience;
      const mesh = app.coverMeshes[app.activeIndex];
      const position = mesh.getWorldPosition(mesh.position.clone());
      position.project(app.camera);
      return {
        x: (position.x * 0.5 + 0.5) * window.innerWidth,
        y: (-position.y * 0.5 + 0.5) * window.innerHeight,
      };
    });

    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(200);
    await page.mouse.click(point.x, point.y);
    const focusSamples = await collectCameraSamples(page, 55);
    assertSmoothCameraSamples(focusSamples, `${name} focus`, { requireFocus: true });
    await page.waitForFunction(() => window.galleryExperience.focusBlend > 0.88);
    await assertFocusedCoverFraming(page);
    await assertFocusTiltResponds(page);
    await page.screenshot({
      path: join(outputDir, 'focus-open.png'),
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.body.classList.contains('is-focused') && window.galleryExperience.focusBlend < 0.12,
    );
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1100);
    await page.screenshot({
      path: join(outputDir, 'desktop-end.png'),
      fullPage: false,
    });
  }

  if (focusButton) {
    await page.locator('#openActiveWork').click();
    const focusSamples = await collectCameraSamples(page, 55);
    assertSmoothCameraSamples(focusSamples, `${name} focus`, { requireFocus: true });
    await page.waitForFunction(() => window.galleryExperience.focusBlend > 0.88);
    await assertFocusedCoverFraming(page);
    await assertFocusTiltResponds(page);
    await page.screenshot({
      path: join(outputDir, 'mobile-focus.png'),
      fullPage: false,
    });
  }

  await page.close();
  console.log(`${name}: screenshot ok`, screenshotStats);
}

async function assertCoverFraming(page) {
  for (let index = 0; index < 6; index += 1) {
    await page.evaluate((progress) => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, maxScroll * progress);
    }, index / 5);
    await page.waitForTimeout(1050);

    const bounds = await getCoverBounds(page, index);
    assertVisibleBounds(bounds, `cover ${index + 1}`, 8);
  }
}

async function assertSkipRoute(page) {
  await page.locator('.rail-item').nth(0).click();
  const samples = await collectCameraSamples(page, 70);
  assertSmoothCameraSamples(samples, 'desktop skip route', { maxFrameStep: 0.95 });

  if (!samples.some((sample) => sample.routeType === 'skip')) {
    throw new Error('large rail jump did not use skip route');
  }

  await page.waitForFunction(
    () => !window.galleryExperience.jumpRoute && window.galleryExperience.galleryProgress < 0.025,
  );
  const bounds = await getCoverBounds(page, 0);
  assertVisibleBounds(bounds, 'skip route target cover', 8);
}

async function assertFocusedCoverFraming(page) {
  const bounds = await page.evaluate(() => {
    const app = window.galleryExperience;
    return app.focusedIndex;
  });
  if (!Number.isInteger(bounds)) {
    throw new Error('focusedIndex was not set');
  }
  const coverBounds = await getCoverBounds(page, bounds);
  assertVisibleBounds(coverBounds, `focused cover ${bounds + 1}`, 10);
}

async function assertFocusTiltResponds(page) {
  const before = await getFocusedVisualRotation(page);
  await page.mouse.move(page.viewportSize().width * 0.82, page.viewportSize().height * 0.32);
  await page.waitForTimeout(360);
  const right = await getFocusedVisualRotation(page);
  await page.mouse.move(page.viewportSize().width * 0.18, page.viewportSize().height * 0.68);
  await page.waitForTimeout(360);
  const left = await getFocusedVisualRotation(page);

  if (Math.abs(right.y - before.y) < 0.012 || Math.abs(right.y - left.y) < 0.035) {
    throw new Error(
      `focused card tilt did not respond enough: ${JSON.stringify({ before, right, left })}`,
    );
  }

  await assertFocusedCoverFraming(page);
}

async function getFocusedVisualRotation(page) {
  return page.evaluate(() => {
    const app = window.galleryExperience;
    const visual = app.cardGroups[app.focusedIndex]?.userData.visual;
    return {
      x: visual.rotation.x,
      y: visual.rotation.y,
      z: visual.rotation.z,
    };
  });
}

async function getCoverBounds(page, workIndex) {
  return page.evaluate((index) => {
      const app = window.galleryExperience;
      const mesh = app.coverMeshes[index];
      const Vector3 = app.camera.position.constructor;
      mesh.updateWorldMatrix(true, false);
      app.camera.updateMatrixWorld();

      const positions = mesh.geometry.attributes.position;
      const points = [];
      for (let vertex = 0; vertex < positions.count; vertex += 1) {
        const point = new Vector3(
          positions.getX(vertex),
          positions.getY(vertex),
          positions.getZ(vertex),
        );
        mesh.localToWorld(point);
        point.project(app.camera);
        points.push({
          x: (point.x * 0.5 + 0.5) * window.innerWidth,
          y: (-point.y * 0.5 + 0.5) * window.innerHeight,
          z: point.z,
        });
      }

      return {
        minX: Math.min(...points.map((point) => point.x)),
        maxX: Math.max(...points.map((point) => point.x)),
        minY: Math.min(...points.map((point) => point.y)),
        maxY: Math.max(...points.map((point) => point.y)),
        minZ: Math.min(...points.map((point) => point.z)),
        maxZ: Math.max(...points.map((point) => point.z)),
        width: window.innerWidth,
        height: window.innerHeight,
      };
  }, workIndex);
}

function assertVisibleBounds(bounds, label, margin) {
  const clipped =
    bounds.minX < margin ||
    bounds.maxX > bounds.width - margin ||
    bounds.minY < margin ||
    bounds.maxY > bounds.height - margin ||
    bounds.minZ < -1 ||
    bounds.maxZ > 1;

  if (clipped) {
    throw new Error(`${label} is clipped: ${JSON.stringify(bounds)}`);
  }
}

async function collectCameraSamples(page, count) {
  return page.evaluate(async (sampleCount) => {
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const app = window.galleryExperience;
      samples.push({
        x: app.camera.position.x,
        y: app.camera.position.y,
        z: app.camera.position.z,
        fov: app.camera.fov,
        focusBlend: app.focusBlend,
        routeType: app.jumpRoute?.routeType ?? null,
      });
    }
    return samples;
  }, count);
}

function assertSmoothCameraSamples(samples, label, options = {}) {
  const { maxFrameStep = 0.85, requireFocus = false } = options;
  const numericKeys = ['x', 'y', 'z', 'fov', 'focusBlend'];
  if (
    !samples.length ||
    samples.some((sample) => numericKeys.some((key) => !Number.isFinite(sample[key])))
  ) {
    throw new Error(`${label} camera samples contain invalid values`);
  }

  let measuredMaxStep = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const step = Math.hypot(current.x - previous.x, current.y - previous.y, current.z - previous.z);
    measuredMaxStep = Math.max(measuredMaxStep, step);
  }

  if (measuredMaxStep > maxFrameStep) {
    throw new Error(`${label} camera moved too abruptly: max frame step ${measuredMaxStep.toFixed(3)}`);
  }

  if (requireFocus && samples.at(-1).focusBlend < 0.68) {
    throw new Error(`${label} did not enter focus smoothly: ${samples.at(-1).focusBlend.toFixed(3)}`);
  }
}

function analyzeScreenshot(buffer) {
  const png = PNG.sync.read(buffer);
  let lit = 0;
  let varied = 0;
  const stride = 16;

  for (let y = 0; y < png.height; y += stride) {
    for (let x = 0; x < png.width; x += stride) {
      const index = (png.width * y + x) * 4;
      const red = png.data[index];
      const green = png.data[index + 1];
      const blue = png.data[index + 2];
      if (red + green + blue > 42) {
        lit += 1;
      }
      if (Math.max(red, green, blue) - Math.min(red, green, blue) > 10) {
        varied += 1;
      }
    }
  }

  const total = Math.ceil(png.width / stride) * Math.ceil(png.height / stride);
  return {
    litRatio: Number((lit / total).toFixed(4)),
    variedRatio: Number((varied / total).toFixed(4)),
    sampled: total,
  };
}
