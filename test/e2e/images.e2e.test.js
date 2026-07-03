/**
 * Phase 4 — Red-dot image loading (spec §6, highest regression risk).
 *
 * Chrome MV3 requires extension resources used in web-page-injected CSS to be
 * declared in web_accessible_resources. Chrome also resolves url() in
 * insertCSS-injected stylesheets relative to the page origin, not the
 * extension origin — so we set background-image inline via chrome.runtime.getURL
 * (spec §6 fallback). Three levels of verification:
 *
 *  1. WAR check   — the fixture page can fetch() chrome-extension:// URLs.
 *  2. CSS check   — #retracement's computed background-image is the extension URL.
 *  3. Load check  — Image elements with those URLs load (naturalWidth > 0).
 */
import { beforeAll, afterAll, beforeEach, afterEach, test, expect } from 'vitest';
import {
  buildTestExtension, launchWithExtension, fixtureServer,
  activateTool, EXTENSION_ID,
} from '../helpers/extension.js';
import { drawBox } from '../helpers/draw.js';

let ctx, server;
let fixturePage, popup;

beforeAll(async () => {
  const ext = await buildTestExtension();
  ctx = await launchWithExtension(ext);
  server = await fixtureServer();
});

afterAll(async () => {
  await ctx?.close();
  await server?.close();
});

beforeEach(async () => {
  fixturePage = await ctx.newPage();
  await fixturePage.goto(server.url);
});

afterEach(async () => {
  await fixturePage?.close();
  await popup?.close().catch(() => {});
  popup = null;
});

// --- 1. WAR check: fixture page can fetch the extension resources directly ---

test('red-dot.PNG is web-accessible — fetch() from page returns 200 (spec §6)', async () => {
  const result = await fixturePage.evaluate(async (url) => {
    try {
      const resp = await fetch(url);
      return { ok: resp.ok, status: resp.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, `chrome-extension://${EXTENSION_ID}/data/red-dot.PNG`);

  expect(result.ok, `Expected 200 but got: ${JSON.stringify(result)}`).toBe(true);
  expect(result.status).toBe(200);
});

test('red-dot2.PNG is web-accessible — fetch() from page returns 200 (spec §6)', async () => {
  const result = await fixturePage.evaluate(async (url) => {
    try {
      const resp = await fetch(url);
      return { ok: resp.ok, status: resp.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, `chrome-extension://${EXTENSION_ID}/data/red-dot2.PNG`);

  expect(result.ok, `Expected 200 but got: ${JSON.stringify(result)}`).toBe(true);
  expect(result.status).toBe(200);
});

// --- 2. CSS check: computed style uses extension URL, not page origin ---------

test('#retracement background-image uses chrome-extension:// URL after drawing (spec §6)', async () => {
  popup = await activateTool(ctx, fixturePage, server.url, 'retracement');
  await drawBox(fixturePage, { x: 100, y: 100 }, { x: 350, y: 280 });

  const bgImage = await fixturePage.evaluate(() => {
    const el = document.getElementById('retracement');
    return el ? getComputedStyle(el).backgroundImage : '';
  });

  expect(bgImage, 'background-image must not be empty or none').not.toBe('');
  expect(bgImage, 'background-image must not be empty or none').not.toBe('none');
  // Inline style set via chrome.runtime.getURL — must be an extension URL.
  expect(bgImage, `Got: ${bgImage}`).toContain('chrome-extension://');
  // Must not fall back to the page origin.
  expect(bgImage).not.toContain('http://localhost');
});

// --- 3. Load check: Image elements with those URLs actually render -----------

test('red-dot images load with naturalWidth > 0 from the fixture page (spec §6)', async () => {
  const rdUrl  = `chrome-extension://${EXTENSION_ID}/data/red-dot.PNG`;
  const rd2Url = `chrome-extension://${EXTENSION_ID}/data/red-dot2.PNG`;

  const [rdLoaded, rd2Loaded] = await fixturePage.evaluate(async ([u1, u2]) => {
    function loadImage(url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload  = () => resolve(img.naturalWidth > 0);
        img.onerror = () => resolve(false);
        img.src = url;
      });
    }
    return Promise.all([loadImage(u1), loadImage(u2)]);
  }, [rdUrl, rd2Url]);

  expect(rdLoaded,  'red-dot.PNG should load with naturalWidth > 0').toBe(true);
  expect(rd2Loaded, 'red-dot2.PNG should load with naturalWidth > 0').toBe(true);
});
