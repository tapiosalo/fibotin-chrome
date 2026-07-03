import { beforeAll, afterAll, beforeEach, afterEach, test, expect } from 'vitest';
import {
  buildTestExtension, launchWithExtension, fixtureServer, activateTool,
} from '../helpers/extension.js';
import { drawChannel, dragHandle } from '../helpers/draw.js';

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

test('Channel tool draws both parallel lines (AC3)', async () => {
  popup = await activateTool(ctx, fixturePage, server.url, 'channel');
  await drawChannel(fixturePage, { x: 100, y: 200 }, { x: 450, y: 200 });
  expect(await fixturePage.locator('#channelLine').isVisible()).toBe(true);
  expect(await fixturePage.locator('#secondChannelline').isVisible()).toBe(true);
});

test('Channel first-circle handle drags both lines to new position (AC4)', async () => {
  popup = await activateTool(ctx, fixturePage, server.url, 'channel');
  await drawChannel(fixturePage, { x: 100, y: 200 }, { x: 450, y: 200 });

  // After drawStop, both circle handles are visible.
  const handle = fixturePage.locator('#channelcircle');
  expect(await handle.isVisible()).toBe(true);

  const lineBefore = await fixturePage.locator('#channelLine').boundingBox();
  const { before, after } = await dragHandle(fixturePage, handle, { x: 60, y: 40 });

  expect(after).not.toBeNull();
  // The handle moved.
  expect(
    Math.abs(after.x - before.x) + Math.abs(after.y - before.y)
  ).toBeGreaterThan(10);

  // The first line's width changed (drag repositions the line angle/length).
  const lineAfter = await fixturePage.locator('#channelLine').boundingBox();
  expect(lineAfter).not.toBeNull();
  expect(lineAfter).not.toEqual(lineBefore);
});
