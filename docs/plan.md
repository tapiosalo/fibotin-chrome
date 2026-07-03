# Fibotin — Chrome Port Implementation Plan

Status: Draft
Implements: [`spec.md`](spec.md)
Test stack: **Vitest** (runner) + **Playwright** (browser driver, Chromium with the unpacked extension)

This plan turns [`spec.md`](spec.md) into phased, testable work. Each phase ships code **and** the E2E tests that prove it, mapped back to the usability acceptance criteria in spec §2 (referenced here as **AC1–AC8**).

## 1. Principles

- **Parity first.** Every phase is validated against the spec's acceptance criteria; a change is "done" only when its E2E test passes.
- **Production manifest stays minimal.** The shipped `manifest.json` keeps only `activeTab` + `scripting` and no host permissions. Test-only manifest augmentation (§4.3) lives entirely in the test harness — never in the shipped files.
- **Small, forced changes only.** Follow spec §5: no logic changes to the drawing/drag engine beyond the namespace rename.
- **Work on a branch** (`chrome-mv3-port`), not `master`.

## 2. Dependencies & tooling

Add a `package.json` (the project currently has none) with dev dependencies only — the extension itself remains dependency-free at runtime.

```jsonc
{
  "name": "fibotin",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run test/unit",
    "test:e2e": "vitest run test/e2e",
    "test:watch": "vitest",
    "pretest:e2e": "playwright install chromium"
  },
  "devDependencies": {
    "vitest": "^2",
    "playwright": "^1",
    "get-port": "^7"
  }
}
```

- **Vitest** is the test framework/runner for both unit (manifest/static checks, Node env) and E2E (drives Playwright from inside a test).
- **Playwright** (the library, not `@playwright/test`) launches Chromium with the extension. Chromium is installed via `playwright install chromium`.
- CI additionally runs `npx playwright install --with-deps chromium`.

## 3. File & directory layout (new)

```
package.json
vitest.config.js
test/
  helpers/
    extension.js        # buildTestExtension(), launchWithExtension(), fixtureServer()
    draw.js             # drag() helper + per-tool draw gestures
  fixtures/
    page.html           # neutral page the overlay draws onto (served over http)
    test-key.txt        # pinned manifest "key" -> deterministic EXTENSION_ID
  unit/
    manifest.test.js    # static assertions on the shipped manifest (Node, no browser)
  e2e/
    smoke.e2e.test.js
    retracement.e2e.test.js
    line.e2e.test.js
    arcs.e2e.test.js
    channel.e2e.test.js
    reset.e2e.test.js
    privileged.e2e.test.js
```

`vitest.config.js` runs E2E serially (one browser at a time) with generous timeouts:

```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,          // one Chromium context at a time
    pool: 'forks',
  },
});
```

## 4. Test architecture (the hard parts, decided up front)

E2E-testing an MV3 extension has three real constraints. Decisions:

### 4.1 The extension ID (no service worker to read it from)

Fibotin has no background service worker, so Playwright's usual `context.serviceWorkers()[0].url()` trick to discover the extension ID does not apply. **Decision: pin a `key` in the test-staged manifest** so the ID is deterministic. The harness generates/stores a keypair once (`test/fixtures/test-key.txt`) and exports the resulting constant `EXTENSION_ID`. The shipped `manifest.json` contains **no** `key`.

### 4.2 The toolbar gesture is not automatable

Playwright drives page DOM, not the browser toolbar, so it cannot click the real action button, and there is no reliable `chrome.action.openPopup()` in a headless test. **Decision:** open the popup document directly as a page (`chrome-extension://<EXTENSION_ID>/data/panel.html`) and, before its scripts run, stub the single call `chrome.tabs.query({active:true, currentWindow:true})` via `page.addInitScript(...)` so it resolves to the **fixture tab's id**. `submit.js` then runs completely unmodified and injects into the real fixture tab. Only tab *resolution* is pinned; the insertCSS → executeScript → sendMessage path and the content script run for real.

### 4.3 `activeTab` won't grant injection without the gesture

Because the real action gesture never fires in tests, `activeTab` grants nothing, so `chrome.scripting.*` against the fixture tab would be denied. **Decision:** the harness stages a **temp copy** of the extension into a tmp dir and writes an augmented manifest = shipped manifest **plus** `"key"` (§4.1) **plus** `"host_permissions": ["http://localhost/*"]` so injection into the local fixture origin is allowed. Playwright loads that temp copy. The shipped manifest is never modified, and `test/unit/manifest.test.js` asserts the shipped file stays minimal.

### 4.4 Headless

Extensions require a persistent context. **Decision:** run Chromium headed under `xvfb-run` in CI (most reliable), and allow local `--headless=new` via an env flag for fast local iteration. The harness reads `HEADLESS` env.

### 4.5 Harness sketch

```js
// test/helpers/extension.js
import { chromium } from 'playwright';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os'; import path from 'node:path';
import http from 'node:http'; import getPort from 'get-port';

export const EXTENSION_ID = '<derived-from-test-key>'; // deterministic

export async function buildTestExtension(srcRoot) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fibotin-'));
  await cp(srcRoot, dir, { recursive: true, filter: (p) => !p.includes('.git') && !p.includes('/test') && !p.includes('/docs') });
  const manifest = JSON.parse(await readFile(path.join(srcRoot, 'manifest.json'), 'utf8'));
  manifest.key = (await readFile(new URL('../fixtures/test-key.txt', import.meta.url), 'utf8')).trim();
  manifest.host_permissions = ['http://localhost/*'];
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

export async function fixtureServer() {
  const port = await getPort();
  const html = await readFile(new URL('../fixtures/page.html', import.meta.url));
  const server = http.createServer((_, res) => { res.setHeader('content-type', 'text/html'); res.end(html); });
  await new Promise((r) => server.listen(port, r));
  return { url: `http://localhost:${port}/`, close: () => server.close() };
}

export async function launchWithExtension(extPath) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'fibotin-profile-'));
  return chromium.launchPersistentContext(userDataDir, {
    headless: process.env.HEADLESS === 'new' ? true : false,
    args: [
      ...(process.env.HEADLESS === 'new' ? ['--headless=new'] : []),
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });
}

// Open the popup, but point its active-tab lookup at the fixture tab.
export async function openPopupTargeting(context, fixtureTabId) {
  const popup = await context.newPage();
  await popup.addInitScript((tabId) => {
    const realQuery = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (info) =>
      (info && info.active) ? Promise.resolve([{ id: tabId }]) : realQuery(info);
  }, fixtureTabId);
  await popup.goto(`chrome-extension://${EXTENSION_ID}/data/panel.html`);
  return popup;
}
```

### 4.6 Example E2E spec

```js
// test/e2e/retracement.e2e.test.js
import { beforeAll, afterAll, test, expect } from 'vitest';
import { buildTestExtension, launchWithExtension, fixtureServer, openPopupTargeting } from '../helpers/extension.js';
import { drawBox } from '../helpers/draw.js';

let ctx, server, page, popup;
beforeAll(async () => {
  const ext = await buildTestExtension(new URL('../../', import.meta.url).pathname);
  ctx = await launchWithExtension(ext);
  server = await fixtureServer();
  page = await ctx.newPage();
  await page.goto(server.url);
});
afterAll(async () => { await ctx?.close(); server?.close(); });

test('retracement draws an overlay with loaded Fibonacci band images (AC2, AC3, AC5)', async () => {
  const tabId = await page.evaluate(() => /* resolved via chrome from an ext page */ 0); // see helper
  popup = await openPopupTargeting(ctx, tabId);
  // Assert the band image actually loads from the extension (the §6 risk):
  const imgResponse = page.waitForResponse((r) => r.url().includes('red-dot') && r.status() === 200);
  await popup.click('#retracement');           // real menu click -> real injection
  await page.waitForSelector('#base');          // overlay present (AC2)
  await drawBox(page, { x: 120, y: 120 }, { x: 320, y: 260 });
  await expect(page.locator('#retracement')).toBeVisible(); // shape drawn (AC3)
  await imgResponse;                            // bands render (AC5, spec §6)
});
```

(The fixture tab id is obtained in the harness from an extension page that has `host_permissions` for localhost, via `chrome.tabs.query({url:'http://localhost/*'})`; wrapped in a helper.)

## 5. Phases

Each phase is a small PR on the `chrome-mv3-port` branch with its tests green.

### Phase 1 — MV3 manifest + test harness foundation

Establishes a loadable MV3 extension and the machinery to test it.

- Implement the MV3 `manifest.json` from spec §5.1 (`manifest_version:3`, `action`, `permissions:["activeTab","scripting"]`, `web_accessible_resources` for the red-dots, `icons.128`). Add `data/icon-128.png`.
- Add `package.json`, `vitest.config.js`, and `test/helpers/*`, `test/fixtures/*` (§3, §4). Generate `test/fixtures/test-key.txt` and record the derived `EXTENSION_ID`.
- **Unit test** `manifest.test.js`: shipped manifest is MV3, permissions are exactly `["activeTab","scripting"]`, **no** `host_permissions` and **no** `key` (AC8), `action.default_popup === "data/panel.html"`, and `web_accessible_resources` lists both red-dot files (spec §6).
- **E2E** `smoke.e2e.test.js`: the extension loads into a persistent context and `panel.html` opens and renders the 5 menu items (AC1).
- **Exit criteria:** `npm run test:unit` and the smoke E2E pass; extension loads via `chrome://extensions` → Load unpacked without errors.

### Phase 2 — Popup controller (`data/submit.js`)

Rewrite popup wiring to the MV3 `chrome.scripting` API per spec §5.2.

- `chrome.*` namespace; resolve active tab id; `chrome.scripting.executeScript/insertCSS` with `target`/`files`; preserve the insertCSS → sendMessage → `window.close()` order; `.catch` error handling.
- **E2E** `retracement.e2e.test.js` (the §4.6 example): selecting **Retracement** injects the content script, activates the overlay (AC2), and drawing produces the shape (AC3). Band-image assertion is added in Phase 4 but stubbed/skipped here if images aren't wired yet.
- **Exit criteria:** overlay appears and a retracement box can be drawn end-to-end through a real popup click.

### Phase 3 — Content script namespace + full tool/drag/reset coverage

Apply the one content-script change and prove every tool.

- `content-scripts/content.js`: `browser.runtime.onMessage` → `chrome.runtime.onMessage` (spec §5.3). No other logic changes.
- Add `chrome.scripting.removeCSS` wiring for **Reset** in `submit.js` (spec §5.2).
- **E2E**: `line`, `arcs`, `channel` specs — each selects the tool, draws via mouse gestures, asserts the tool's root element exists/visible (AC3). `drag` assertions in `line`/`channel` specs: grab a circle handle, move, assert position delta (AC4). `reset.e2e.test.js`: after drawing, click **Reset** and assert `#base` is removed and the injected stylesheet no longer applies (AC6). A shared spec asserts re-selecting a tool clears the prior drawing (AC7).
- **Exit criteria:** all four tools draw, handles drag, reset clears, re-select clears — all green.

### Phase 4 — Red-dot image loading (spec §6, highest regression risk)

Guarantee the retracement bands render in Chrome.

- Verify relative `url()` resolution + `web_accessible_resources` works; the retracement E2E asserts the `red-dot*.PNG` requests return **200** on the fixture page (network assertion in §4.6).
- If blank in the target Chrome version, apply the spec §6 fallback (set backgrounds via `chrome.runtime.getURL` in `content.js`) and keep the same WAR entry; re-run the E2E.
- **Exit criteria:** retracement band-image responses are 200 and the bands are visibly present.

### Phase 5 — Edge cases, packaging, CI, docs

- **E2E** `privileged.e2e.test.js` (best-effort): attempting the flow on a `chrome://` tab leaves the page unmodified and logs an error, matching Firefox (AC via spec §9). Mark `test.skip` if the target Chrome blocks navigation to `chrome://` under automation.
- Packaging: produce a store zip (exclude `.git`, `test/`, `docs/`, `node_modules/`, `package*.json`); confirm 128px icon and listing assets (spec §8).
- CI: GitHub Actions workflow — `npm ci`, `npx playwright install --with-deps chromium`, `xvfb-run -a npm test`.
- Docs: update `README.md` (Chrome install: Load unpacked / Web Store once published) and `CLAUDE.md` (note MV3 + the test commands). Keep the Firefox notes accurate per spec §10 if dual-support is later pursued.
- **Exit criteria:** full `npm test` green in CI; zip installs cleanly in a fresh Chrome profile; docs updated.

## 6. Traceability: E2E specs → acceptance criteria

| Spec AC (spec §2) | Covered by |
| --- | --- |
| AC1 popup has 5 items | `smoke.e2e` |
| AC2 tool activates overlay | `retracement/line/arcs/channel.e2e` (`#base` appears) |
| AC3 click-drag draws each shape | `retracement/line/arcs/channel.e2e` |
| AC4 handles reposition shapes | `line.e2e`, `channel.e2e` (drag delta) |
| AC5 retracement bands render | `retracement.e2e` (image 200) + Phase 4 |
| AC6 reset removes overlay + CSS | `reset.e2e` |
| AC7 one shape at a time | `reset.e2e` / dedicated re-select assertion |
| AC8 minimal permissions | `manifest.test.js` (unit) |

## 7. Testing risks & mitigations

- **Toolbar/popup gesture not automatable** → open popup doc directly + stub active-tab lookup (§4.2).
- **`activeTab` denies injection in tests** → test-staged manifest adds `host_permissions: http://localhost/*` (§4.3); shipped manifest unaffected and unit-tested.
- **No service worker → no ID discovery** → pinned `key` → deterministic `EXTENSION_ID` (§4.1).
- **Headless extension support** → headed under `xvfb` in CI; `--headless=new` opt-in locally (§4.4).
- **Flaky draw timing** → wait on `#base`/target selector before gesturing; assert on network response for images rather than pixel diffs.
- **Background-image asset blocked** → the whole point of Phase 4; asserted via network 200, with the §6 `getURL` fallback ready.

## 8. Rollout

1. Branch `chrome-mv3-port`; land phases 1→5 as small commits/PRs, tests green each phase.
2. Manual pass of the spec §8 matrix in a real Chrome profile before packaging.
3. Do not delete/alter the Firefox behavior expectations; if dual-browser support is chosen later, follow spec §10.
```
