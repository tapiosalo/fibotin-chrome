/**
 * Low-level Playwright drag helper.
 * Simulates a press-drag-release gesture from `from` to `to` on `page`.
 */
export async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

/**
 * Drag a handle element by a pixel delta.
 * Grabs the center of `locator`'s bounding box, moves by `delta`, releases.
 * Returns { before, after } bounding boxes so tests can assert position change.
 */
export async function dragHandle(page, locator, delta) {
  const before = await locator.boundingBox();
  if (!before) throw new Error(`dragHandle: element not found in DOM`);
  const cx = before.x + before.width / 2;
  const cy = before.y + before.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + delta.x, cy + delta.y, { steps: 10 });
  await page.mouse.up();
  const after = await locator.boundingBox();
  return { before, after };
}

// Per-tool draw gestures — call after activateTool() and #base is present.
export const drawBox     = (page, from, to) => drag(page, from, to);
export const drawLine    = (page, from, to) => drag(page, from, to);
export const drawArcs    = (page, from, to) => drag(page, from, to);
export const drawChannel = (page, from, to) => drag(page, from, to);
