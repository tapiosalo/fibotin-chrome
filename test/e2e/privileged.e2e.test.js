/**
 * Phase 5 — Edge case: privileged/unreachable pages (spec §9).
 *
 * When executeScript fails (privileged tab, wrong-origin tab, etc.), submit.js
 * must catch the error and return early — the popup stays open, listenForClicks
 * is never wired, and the target page is left unmodified.
 *
 * Real chrome:// navigation is blocked by Playwright automation, so that
 * variant is documented with test.skip below. The error-handling path is
 * exercised via an invalid tab ID (99999) which triggers the same code branch.
 */
import { beforeAll, afterAll, beforeEach, afterEach, test, expect } from 'vitest';
import {
  buildTestExtension, launchWithExtension, fixtureServer, openPopupTargeting,
} from '../helpers/extension.js';

let ctx, server;
let fixturePage;

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
});

test('injection failure is caught — popup stays open, page is unmodified (spec §9)', async () => {
  // Pass an invalid tab ID (99999) so chrome.scripting.executeScript throws.
  // This exercises the same error-handling path as a privileged chrome:// page.
  const popup = await openPopupTargeting(ctx, 99999);

  // Give main() time to run and encounter the error.
  await new Promise((r) => setTimeout(r, 1500));

  // The popup should still be open — main() caught the error rather than crashing.
  expect(popup.isClosed()).toBe(false);

  // The fixture page must be unmodified — no overlay injected.
  expect(await fixturePage.locator('#base').count()).toBe(0);

  await popup.close();
});

test('clicking a tool after injection failure does nothing (spec §9)', async () => {
  const popup = await openPopupTargeting(ctx, 99999);
  await new Promise((r) => setTimeout(r, 1500));

  // listenForClicks() was never called, so clicking a tool is a no-op.
  await popup.click('#retracement').catch(() => {});
  await new Promise((r) => setTimeout(r, 500));

  expect(await fixturePage.locator('#base').count()).toBe(0);

  await popup.close();
});

// Playwright automation blocks navigation to chrome:// pages.
// Manual verification: open the popup on chrome://extensions — buttons are inert
// and the console logs "Failed to execute fibotin content script: ...".
test.skip('popup buttons are inert on chrome:// pages (manual verification only)', () => {});
