import { beforeAll, afterAll, beforeEach, afterEach, test, expect } from 'vitest';
import {
  buildTestExtension, launchWithExtension,
  fixtureServer, openPopupTargeting, getTabId,
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
  await popup?.close().catch(() => {}); // popup may already be closed by window.close()
  popup = null;
});

test('selecting Retracement activates the overlay (AC2)', async () => {
  const tabId = await getTabId(ctx, server.url);
  popup = await openPopupTargeting(ctx, tabId);

  // Wait for main() to finish injecting the content script before clicking.
  await popup.waitForFunction(() => window._fibotinInjected, { timeout: 10_000 });

  await popup.click('#retracement');

  // #base is the full-viewport overlay appended to the fixture page.
  await fixturePage.waitForSelector('#base', { timeout: 10_000 });
  expect(await fixturePage.locator('#base').isVisible()).toBe(true);
});

test('Retracement draws a box with the correct element id (AC3)', async () => {
  const tabId = await getTabId(ctx, server.url);
  popup = await openPopupTargeting(ctx, tabId);
  await popup.waitForFunction(() => window._fibotinInjected, { timeout: 10_000 });
  await popup.click('#retracement');
  await fixturePage.waitForSelector('#base', { timeout: 10_000 });

  // Drag across the fixture page to draw the retracement box.
  await drawBox(fixturePage, { x: 100, y: 100 }, { x: 350, y: 280 });

  expect(await fixturePage.locator('#retracement').isVisible()).toBe(true);
});

test('drawn retracement box has non-zero dimensions after drag (AC3)', async () => {
  const tabId = await getTabId(ctx, server.url);
  popup = await openPopupTargeting(ctx, tabId);
  await popup.waitForFunction(() => window._fibotinInjected, { timeout: 10_000 });
  await popup.click('#retracement');
  await fixturePage.waitForSelector('#base', { timeout: 10_000 });

  await drawBox(fixturePage, { x: 80, y: 80 }, { x: 400, y: 300 });

  const box = await fixturePage.locator('#retracement').boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
});
