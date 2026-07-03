import { beforeAll, afterAll, beforeEach, afterEach, test, expect } from 'vitest';
import {
  buildTestExtension, launchWithExtension, fixtureServer, activateTool,
} from '../helpers/extension.js';
import { drawArcs } from '../helpers/draw.js';

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

test('Arcs tool draws the arcs container element (AC3)', async () => {
  popup = await activateTool(ctx, fixturePage, server.url, 'arcs');
  await drawArcs(fixturePage, { x: 200, y: 250 }, { x: 450, y: 250 });
  // #arcs is the root container; #arcsline is the radius indicator line.
  expect(await fixturePage.locator('#arcs').isVisible()).toBe(true);
  expect(await fixturePage.locator('#arcsline').isVisible()).toBe(true);
});

test('Arcs tool draws the concentric circle elements (AC3)', async () => {
  popup = await activateTool(ctx, fixturePage, server.url, 'arcs');
  await drawArcs(fixturePage, { x: 200, y: 250 }, { x: 450, y: 250 });
  // circlebase and the three fibonacci circles should be in the DOM.
  expect(await fixturePage.locator('#circlebase').count()).toBe(1);
  expect(await fixturePage.locator('#circle1').count()).toBe(1);
  expect(await fixturePage.locator('#circle2').count()).toBe(1);
  expect(await fixturePage.locator('#circle3').count()).toBe(1);
});
