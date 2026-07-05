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
  await verifyViewport({ name: 'mobile', width: 390, height: 844, openAlbumButton: true });
} finally {
  await browser.close();
}

async function verifyViewport({ name, width, height, clickCover, openAlbumButton }) {
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
    await page.waitForFunction(() => document.body.classList.contains('album-open'));
    await page.screenshot({
      path: join(outputDir, 'album-open.png'),
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.classList.contains('album-open'));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#credits')).opacity) > 0.8);
    await page.screenshot({
      path: join(outputDir, 'desktop-end.png'),
      fullPage: false,
    });
  }

  if (openAlbumButton) {
    await page.locator('#openActiveWork').click();
    await page.waitForFunction(() => document.body.classList.contains('album-open'));
    await page.screenshot({
      path: join(outputDir, 'mobile-album.png'),
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
    }, (index / 5) * 0.88);
    await page.waitForTimeout(1050);

    const bounds = await page.evaluate((workIndex) => {
      const app = window.galleryExperience;
      const mesh = app.coverMeshes[workIndex];
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
    }, index);

    const margin = 8;
    const clipped =
      bounds.minX < margin ||
      bounds.maxX > bounds.width - margin ||
      bounds.minY < margin ||
      bounds.maxY > bounds.height - margin ||
      bounds.minZ < -1 ||
      bounds.maxZ > 1;

    if (clipped) {
      throw new Error(`cover ${index + 1} is clipped: ${JSON.stringify(bounds)}`);
    }
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
