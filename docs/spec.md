# Fibotin — Chrome Port Specification

Status: Draft
Target: Google Chrome (Chromium-based browsers)
Source: Firefox WebExtension, Manifest V2 (current `master`)

## 1. Objective

Port Fibotin to run as a Google Chrome extension while preserving the **exact same user-facing behavior** it has today in Firefox. This is a platform/API migration, not a feature change: no new tools, no UI redesign, no behavioral differences that a user would notice.

See [`../CLAUDE.md`](../CLAUDE.md) for the current architecture (popup → programmatic content-script injection → message passing → drawing overlay). This spec assumes that document as background.

### 1.1 Goals

- Fibotin installs and runs in Chrome with identical usability to the Firefox version.
- Keep the minimal-permission model (no broad host permissions; no data collection).
- Keep the codebase as close to the current structure as possible; change only what the platform forces.

### 1.2 Non-goals

- No new drawing tools, styling changes, or UX changes.
- Not fixing the pre-existing behavioral limitations (one shape at a time, arcs not draggable, dead on privileged pages) — those must behave the same as Firefox unless a platform difference forces otherwise (see §9).
- Not removing Firefox support is out of scope of the requirement, but §10 notes how to keep both.

## 2. Usability parity requirements (acceptance criteria)

The Chrome build MUST reproduce all of the following, which define "same usability":

1. A toolbar button opens a popup menu with five items: **Retracement, Line, Arcs, Channel, Reset** (identical `panel.html` / `menu.css`).
2. Selecting a tool activates a full-viewport crosshair overlay on the current page.
3. Click-drag on the page draws the selected shape (retracement box with Fibonacci bands, trend line, Fibonacci arcs, parallel channel), exactly as today.
4. Drawn shapes can be repositioned by dragging their handles (circle handles / the retracement box), with the same drag behavior implemented in `content.js`.
5. The **retracement** tool shows its horizontal Fibonacci bands, which are rendered from `data/red-dot.PNG` / `data/red-dot2.PNG` background images — these MUST load (see §6).
6. **Reset** removes the overlay and the injected CSS from the page.
7. Only one shape is on screen at a time; re-selecting a tool clears the previous drawing (same as today).
8. The extension requests only the equivalent of `activeTab` — no "read your data on all websites" broad warning beyond what the current model implies.

## 3. Target platform decision: Manifest V3

Chrome no longer accepts new **Manifest V2** submissions and is disabling MV2 extensions. Therefore the Chrome port MUST target **Manifest V3**. This is the single biggest source of required changes, because MV3 removes the `tabs.executeScript` / `tabs.insertCSS` APIs that Fibotin relies on and replaces them with the `chrome.scripting` API.

The extension currently has **no background page/script** and needs none — MV3's service-worker background is therefore not required and will not be added.

## 4. API gap analysis (Firefox MV2 → Chrome MV3)

| Concern | Current (Firefox MV2) | Chrome MV3 target |
| --- | --- | --- |
| Manifest version | `"manifest_version": 2` | `"manifest_version": 3` |
| Toolbar button | `"browser_action"` | `"action"` |
| Namespace | `browser.*` (promises) | `chrome.*` (promises supported in MV3, Chrome 88+) — see §7 |
| Inject content script | `browser.tabs.executeScript({file})` | `chrome.scripting.executeScript({target:{tabId}, files:[...]})` |
| Inject CSS | `browser.tabs.insertCSS(tabId, {file})` | `chrome.scripting.insertCSS({target:{tabId}, files:[...]})` |
| Remove CSS | `browser.tabs.removeCSS(tabId, {file})` | `chrome.scripting.removeCSS({target:{tabId}, files:[...]})` |
| Query active tab | `browser.tabs.query(...)` | `chrome.tabs.query(...)` (unchanged shape) |
| Message to tab | `browser.tabs.sendMessage(id, msg)` | `chrome.tabs.sendMessage(id, msg)` (unchanged shape) |
| Receive message | `browser.runtime.onMessage` | `chrome.runtime.onMessage` (unchanged shape) |
| Permissions | `["activeTab"]` | `["activeTab", "scripting"]` |
| Injected-CSS image assets | worked without declaration (Firefox privilege) | MUST be in `web_accessible_resources` (see §6) |

Key consequence: the `scripting.*` APIs require an explicit **target tab id** and take a **`files` array** (not a single `file`). The popup must therefore look up the active tab id before injecting.

## 5. Per-file changes

### 5.1 `manifest.json` (rewrite)

Target manifest:

```json
{
  "manifest_version": 3,
  "name": "Fibotin",
  "version": "3.0",

  "permissions": [
    "activeTab",
    "scripting"
  ],

  "action": {
    "default_icon": "data/icon-32.png",
    "default_title": "Fibotin",
    "default_popup": "data/panel.html"
  },

  "icons": {
    "32": "data/icon-32.png",
    "128": "data/icon-128.png"
  },

  "web_accessible_resources": [
    {
      "resources": ["data/red-dot.PNG", "data/red-dot2.PNG"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

Notes:
- `scripting` is added; `activeTab` is retained and remains sufficient — clicking the toolbar icon (which opens the popup) grants activeTab access to the current tab, which is exactly when injection happens. No `host_permissions` and no `tabs` permission are needed, preserving the minimal-permission story.
- `web_accessible_resources` is required for the red-dot images (§6). Only the two image files are exposed; scripts/CSS are not.
- `icons.128` is needed for the Chrome Web Store listing (see §8); add a 128×128 PNG. 16/48 are optional but recommended.

### 5.2 `data/submit.js` (popup controller — rewrite the API calls)

Behavioral contract stays identical; only the API calls change. Required shape:

```js
// Resolve the active tab once, inject the content script, then wire clicks.
async function main() {
  let tabId;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab.id;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-scripts/content.js"]
    });
  } catch (error) {
    console.error(`Failed to execute fibotin content script: ${error.message}`);
    return; // buttons stay inert on pages where injection is disallowed (parity with Firefox)
  }
  listenForClicks(tabId);
}

function listenForClicks(tabId) {
  const TOOLS = ["retracement", "line", "arcs", "channel"];

  function reportError(error) { console.error(`Fibotin fails: ${error}`); }

  async function activateTool(command) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["data/style.css"] });
      await chrome.tabs.sendMessage(tabId, { command });
      window.close();
    } catch (error) { reportError(error); }
  }

  async function reset() {
    try {
      await chrome.scripting.removeCSS({ target: { tabId }, files: ["data/style.css"] });
      await chrome.tabs.sendMessage(tabId, { command: "reset" });
    } catch (error) { reportError(error); }
  }

  document.addEventListener("click", (e) => {
    if (TOOLS.indexOf(e.target.id) !== -1) activateTool(e.target.id);
    else if (e.target.id === "reset") reset();
  });
}

main();
```

Differences from the current file:
- `chrome.*` instead of `browser.*`.
- `chrome.scripting.executeScript/insertCSS/removeCSS` with `target` + `files`.
- The active tab id is resolved once and reused (current Firefox code re-queries per click; either is acceptable, but capturing once matches the single-tab lifetime of a popup).
- The message-passing sequence (`insertCSS` → `sendMessage` → `window.close()` for tools; `removeCSS` → `sendMessage` for reset) is preserved exactly.

### 5.3 `content-scripts/content.js` (namespace only)

The entire drawing/drag engine is DOM-only and browser-agnostic — no logic changes. The **only** required change is the message-listener namespace:

- `browser.runtime.onMessage.addListener(...)` → `chrome.runtime.onMessage.addListener(...)`

The `window.hasRun` re-injection guard, the `#base` overlay lifecycle, and the draw/drag handlers all behave identically under MV3's `scripting.executeScript` (content scripts run in the same isolated world as before).

### 5.4 `data/style.css` (unchanged, but see §6)

No rule changes. The relative `url('./red-dot.PNG')` references stay as-is; the fix for Chrome is a manifest-level `web_accessible_resources` declaration, not a CSS change (see §6 for the fallback if relative resolution proves unreliable).

### 5.5 `data/panel.html`, `data/menu.css` (unchanged)

The popup markup and menu styling are standard HTML/CSS with no extension APIs and no inline scripts, so they are compatible with MV3's stricter CSP as-is. No changes.

### 5.6 Icons

Add `data/icon-128.png` (128×128) for the Web Store. Optionally add 16/48 for crisp toolbar/menu rendering. Existing `data/icon-32.png` is reused.

## 6. Resource loading: the red-dot images (critical)

The retracement tool's Fibonacci bands are CSS `background-image`s pointing at `data/red-dot.PNG` and `data/red-dot2.PNG`, declared in `data/style.css`, which is injected into the target page.

- In **Firefox**, images referenced from `insertCSS`-injected stylesheets load as privileged extension resources without any declaration.
- In **Chrome MV3**, a stylesheet injected into a web page is treated as content-script CSS; any `url()` it references is fetched by the **page origin** from the extension, which Chrome blocks unless the resource is listed in `web_accessible_resources`.

**Requirement:** `data/red-dot.PNG` and `data/red-dot2.PNG` MUST be listed in `web_accessible_resources` (see manifest in §5.1). Without this, the retracement bands will not render in Chrome — a direct violation of acceptance criterion §2.5.

**Primary approach:** keep the relative `url()` in `style.css`; Chrome resolves relative URLs in extension-injected CSS against the extension root (`chrome-extension://<id>/data/…`), and the WAR entry makes them loadable.

**Fallback (if relative resolution is unreliable in a target Chrome version):** set the retracement background in `content.js` at element-creation time using `chrome.runtime.getURL("data/red-dot.PNG")` to build absolute URLs. This still requires the same `web_accessible_resources` entry. Prefer the primary approach; document the fallback only if testing shows blank bands.

This item is the single most likely source of a visible regression and must be explicitly verified (see §8).

## 7. Namespace strategy: `chrome.*` vs polyfill

Two viable options:

- **(Recommended) Use `chrome.*` directly.** MV3 on Chrome 88+ returns promises from `chrome.*` APIs, so the existing promise/`async` style is preserved with a simple `browser` → `chrome` rename. Fewest moving parts; no extra files.
- **Use `webextension-polyfill`.** Bundle `browser-polyfill.js` and keep `browser.*` in the source. This eases a future single-codebase cross-browser setup, but it does **not** paper over the `tabs.executeScript` → `scripting.executeScript` API-shape change — those calls must still be rewritten regardless. Given that, the polyfill adds a dependency without removing the main migration work, so it is not recommended for a Chrome-only target.

Decision: **`chrome.*` directly.**

## 8. Packaging & Chrome Web Store

- The extension is unbuilt static files; packaging is zipping the project root (excluding `.git`, `docs/`, `CLAUDE.md`, `README.md` are optional to include but harmless).
- Provide a 128×128 icon (store requirement) and store listing assets (screenshots, description) — out of scope for code but required for publication.
- Local testing: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the project folder. Reload after edits with the reload control on that page.

### Acceptance test matrix (manual, mirrors §2)

Run each on a normal content page (e.g. an article), verifying against the Firefox build:

1. Toolbar icon opens the 5-item popup. ✔ menu identical.
2. Each tool (retracement / line / arcs / channel): select → crosshair overlay appears → click-drag draws the shape.
3. **Retracement bands render** (red-dot images load — §6). ← highest-risk check.
4. Drag each shape's handle to reposition; behavior matches Firefox.
5. Reset removes overlay and injected CSS.
6. Re-selecting a tool clears the previous drawing.
7. Confirm on a privileged page (`chrome://…`, Chrome Web Store) the buttons are inert with only a console error (parity with Firefox §9).
8. Verify the install prompt shows no broad host-permission warning beyond the activeTab model.

## 9. Risks & platform differences

- **Privileged pages:** As in Firefox, `scripting.executeScript` cannot run on `chrome://`, the Web Store, or other extensions' pages. The popup buttons will silently do nothing there. This matches current Firefox behavior and is acceptable per §1.2.
- **Red-dot images (§6):** highest regression risk; explicitly gated in the test matrix.
- **`insertCSS`/`removeCSS` symmetry:** `removeCSS` must be called with the same `files`/`target` used for `insertCSS` for reset to fully undo styling — mirror the argument shapes exactly.
- **activeTab timing:** injection happens when the popup opens (the action-invocation gesture). If a future change moves injection off the action gesture, activeTab would no longer cover it and a host permission would be needed. Keep injection tied to the popup.

## 10. Optional: single cross-browser codebase (informational)

If Firefox support should be retained alongside Chrome from one source tree:
- Firefox now also supports MV3 and the `scripting` API and accepts `chrome.*`, so a single MV3 build can target both, with per-browser manifest differences handled by a small build step or two manifest files.
- Firefox MV3 supports an event-page/background differently and has some `web_accessible_resources` nuances; validate the red-dot images on both.
This is not required by the current objective (Chrome only) and is listed only to inform sequencing.

## 11. Summary of required changes

| File | Change |
| --- | --- |
| `manifest.json` | MV3 rewrite: `manifest_version:3`, `action`, add `scripting` permission, add `web_accessible_resources` for red-dot images, add 128px icon |
| `data/submit.js` | `chrome.*` + `chrome.scripting.executeScript/insertCSS/removeCSS` with `target`/`files`; resolve active tab id before injecting |
| `content-scripts/content.js` | `browser.runtime.onMessage` → `chrome.runtime.onMessage` (no logic change) |
| `data/style.css` | none (relies on §6 manifest declaration) |
| `data/panel.html`, `data/menu.css` | none |
| `data/icon-128.png` | new asset for Web Store |
```
