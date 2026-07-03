import { beforeAll, afterAll, beforeEach, afterEach, test, expect } from 'vitest';
import {
  buildTestExtension, launchWithExtension, fixtureServer, activateTool,
} from '../helpers/extension.js';
import { drawLine, dragHandle } from '../helpers/draw.js';

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

test('Line tool draws a visible line (AC3)', async () => {
  popup = await activateTool(ctx, fixturePage, server.url, 'line');
  await drawLine(fixturePage, { x: 100, y: 200 }, { x: 400, y: 200 });
  expect(await fixturePage.locator('#line').isVisible()).toBe(true);
});

test('Line tool endpoint handle drags to new position (AC4)', async () => {
  popup = await activateTool(ctx, fixturePage, server.url, 'line');
  await drawLine(fixturePage, { x: 100, y: 200 }, { x: 400, y: 200 });

  // The circle handle (#linecircle) should be near the drawn endpoint.
  const handle = fixturePage.locator('#linecircle');
  expect(await handle.isVisible()).toBe(true);

  const { before, after } = await dragHandle(fixturePage, handle, { x: 80, y: 60 });
  expect(after).not.toBeNull();
  // The handle moved a meaningful distance.
  expect(
    Math.abs(after.x - before.x) + Math.abs(after.y - before.y)
  ).toBeGreaterThan(10);
});
