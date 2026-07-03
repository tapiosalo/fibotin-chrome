import { beforeAll, afterAll, beforeEach, afterEach, test, expect } from 'vitest';
import {
  buildTestExtension, launchWithExtension, fixtureServer,
  activateTool, openPopupTargeting, getTabId,
} from '../helpers/extension.js';
import { drawBox } from '../helpers/draw.js';

let ctx, server;
let fixturePage;
const popups = [];

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
  for (const p of popups.splice(0)) await p.close().catch(() => {});
});

test('Reset removes the overlay (#base detached) (AC6)', async () => {
  // Draw a shape to put #base on the page.
  popups.push(await activateTool(ctx, fixturePage, server.url, 'retracement'));
  await drawBox(fixturePage, { x: 100, y: 100 }, { x: 300, y: 250 });
  expect(await fixturePage.locator('#base').count()).toBe(1);

  // Open popup again and click Reset.
  const tabId = await getTabId(ctx, server.url);
  const resetPopup = await openPopupTargeting(ctx, tabId);
  popups.push(resetPopup);
  await resetPopup.waitForFunction(() => window._fibotinInjected, { timeout: 10_000 });
  await resetPopup.click('#reset');

  // #base should be removed from the page.
  await fixturePage.waitForSelector('#base', { state: 'detached', timeout: 10_000 });
  expect(await fixturePage.locator('#base').count()).toBe(0);
});

test('Reset removes the drawn shape elements (AC6)', async () => {
  popups.push(await activateTool(ctx, fixturePage, server.url, 'retracement'));
  await drawBox(fixturePage, { x: 100, y: 100 }, { x: 300, y: 250 });
  expect(await fixturePage.locator('#retracement').count()).toBe(1);

  const tabId = await getTabId(ctx, server.url);
  const resetPopup = await openPopupTargeting(ctx, tabId);
  popups.push(resetPopup);
  await resetPopup.waitForFunction(() => window._fibotinInjected, { timeout: 10_000 });
  await resetPopup.click('#reset');

  await fixturePage.waitForSelector('#base', { state: 'detached', timeout: 10_000 });
  // All child elements are gone with #base.
  expect(await fixturePage.locator('#retracement').count()).toBe(0);
});

test('Re-selecting a tool clears the previous drawing (AC7)', async () => {
  // Draw a retracement.
  popups.push(await activateTool(ctx, fixturePage, server.url, 'retracement'));
  await drawBox(fixturePage, { x: 100, y: 100 }, { x: 300, y: 250 });
  expect(await fixturePage.locator('#retracement').count()).toBe(1);

  // Re-select the line tool — close() runs first, wiping the prior drawing.
  popups.push(await activateTool(ctx, fixturePage, server.url, 'line'));

  // The retracement element is gone (it lived inside the old #base).
  expect(await fixturePage.locator('#retracement').count()).toBe(0);
  // A fresh #base is on the page ready for the new tool.
  expect(await fixturePage.locator('#base').isVisible()).toBe(true);
});
