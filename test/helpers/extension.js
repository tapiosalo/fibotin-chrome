import { chromium } from 'playwright';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../');

// Derive a deterministic Chrome extension ID from the pinned test public key.
// The key file holds the base64-encoded SPKI DER of an RSA-2048 public key.
// Chrome computes the extension ID as the first 16 bytes of SHA-256(DER),
// where each nibble maps to a letter a-p.
const keyBase64 = (await readFile(
  path.join(__dirname, '../fixtures/test-key.txt'), 'utf8'
)).trim();

function deriveExtensionId(b64) {
  const der = Buffer.from(b64, 'base64');
  const hash = createHash('sha256').update(der).digest();
  const chars = 'abcdefghijklmnop';
  let id = '';
  for (let i = 0; i < 16; i++) {
    const byte = hash[i];
    id += chars[(byte >> 4) & 0xf];
    id += chars[byte & 0xf];
  }
  return id;
}

export const EXTENSION_ID = deriveExtensionId(keyBase64);

/**
 * Copy the extension source into a temp dir and augment manifest.json with:
 *   - "key"              → pinned test keypair → deterministic EXTENSION_ID
 *   - "host_permissions" → http://localhost/* so scripting API can inject
 *                          into the local fixture page without the real
 *                          activeTab gesture
 *   - "tabs" permission  → allows chrome.tabs.query({url}) in getTabId()
 *
 * The shipped manifest.json is never touched; the unit test asserts it stays clean.
 */
export async function buildTestExtension() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fibotin-ext-'));

  await cp(ROOT, dir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(ROOT, src);
      return !rel.startsWith('.git') &&
             !rel.startsWith('test') &&
             !rel.startsWith('docs') &&
             !rel.startsWith('node_modules');
    },
  });

  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.key = keyBase64;
  manifest.host_permissions = ['http://localhost/*'];
  manifest.permissions = [...(manifest.permissions ?? []), 'tabs'];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return dir;
}

/**
 * Launch a persistent Chromium context with the extension loaded.
 * Headed by default (required for extensions); set HEADLESS=new to use
 * Chrome's new headless mode which supports extensions on recent builds.
 */
export async function launchWithExtension(extPath) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'fibotin-profile-'));
  const headless = process.env.HEADLESS === 'new';
  return chromium.launchPersistentContext(userDataDir, {
    headless,
    args: [
      ...(headless ? ['--headless=new'] : []),
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });
}

/**
 * Start a local HTTP server that serves test/fixtures/page.html.
 * Returns { url, close }.
 */
export async function fixtureServer() {
  const port = await getPort();
  const html = await readFile(path.join(__dirname, '../fixtures/page.html'));
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  await new Promise((resolve) => server.listen(port, resolve));
  return {
    url: `http://localhost:${port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * Get the Chrome tab ID of the page at the given exact URL.
 * Opens a temporary extension page (which has chrome API access) to run
 * chrome.tabs.query, then closes it.
 * Requires the "tabs" permission and/or matching host_permissions in the
 * test manifest (both added by buildTestExtension).
 */
export async function getTabId(context, pageUrl) {
  const helper = await context.newPage();
  await helper.goto(`chrome-extension://${EXTENSION_ID}/data/panel.html`);
  const tabId = await helper.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({ url });
    return tabs[0]?.id ?? null;
  }, pageUrl);
  await helper.close();
  return tabId;
}

/**
 * Select a drawing tool via the popup and wait for the overlay to appear.
 * Returns the popup page (may already be closed by window.close() — pass to
 * afterEach cleanup with .catch(() => {})).
 */
export async function activateTool(context, fixturePage, serverUrl, toolId) {
  const tabId = await getTabId(context, serverUrl);
  const popup = await openPopupTargeting(context, tabId);
  await popup.waitForFunction(() => window._fibotinInjected, { timeout: 10_000 });
  await popup.click(`#${toolId}`);
  // Wait for the content script to process the message and create #base.
  await fixturePage.waitForSelector('#base', { timeout: 10_000 });
  return popup;
}

/**
 * Open the Fibotin popup as a page and wire it to inject into the fixture tab:
 *
 *   1. Stubs chrome.tabs.query({active,currentWindow}) to resolve to fixtureTabId
 *      so submit.js calls executeScript on the right tab without a real toolbar click.
 *
 *   2. Wraps chrome.scripting.executeScript to expose window._fibotinInjected —
 *      a Promise that resolves when injection completes. Tests should await this
 *      before clicking a tool to avoid a race with main()'s async setup.
 *
 * Usage in a test:
 *   const popup = await openPopupTargeting(ctx, tabId);
 *   await popup.waitForFunction(() => window._fibotinInjected);
 *   await popup.click('#retracement');
 */
export async function openPopupTargeting(context, fixtureTabId) {
  const popup = await context.newPage();

  await popup.addInitScript((tabId) => {
    // Stub active-tab lookup to the fixture tab.
    const _realQuery = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (info) =>
      (info && info.active && info.currentWindow)
        ? Promise.resolve([{ id: tabId }])
        : _realQuery(info);

    // Expose a promise that resolves when executeScript completes so tests
    // can synchronise on injection rather than using arbitrary timeouts.
    const _realExec = chrome.scripting.executeScript.bind(chrome.scripting);
    window._fibotinInjected = new Promise((resolve, reject) => {
      chrome.scripting.executeScript = (...args) =>
        _realExec(...args).then((r) => { resolve(r); return r; }, reject);
    });
  }, fixtureTabId);

  await popup.goto(`chrome-extension://${EXTENSION_ID}/data/panel.html`);
  return popup;
}
