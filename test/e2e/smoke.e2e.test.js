import { beforeAll, afterAll, test, expect } from 'vitest';
import { buildTestExtension, launchWithExtension, EXTENSION_ID } from '../helpers/extension.js';

let ctx;

beforeAll(async () => {
  const ext = await buildTestExtension();
  ctx = await launchWithExtension(ext);
});

afterAll(async () => {
  await ctx?.close();
});

test('extension loads and popup renders all 5 menu items (AC1)', async () => {
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${EXTENSION_ID}/data/panel.html`);

  for (const id of ['retracement', 'line', 'arcs', 'channel', 'reset']) {
    expect(await popup.locator(`#${id}`).isVisible(), `#${id} should be visible`).toBe(true);
  }

  await popup.close();
});
