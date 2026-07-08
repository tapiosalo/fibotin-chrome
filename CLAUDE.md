# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fibotin for Chrome is a **Manifest V3 Chrome extension** ported from the original [Fibotin Firefox add-on](https://addons.mozilla.org/en-US/firefox/addon/fibotin/). From a toolbar popup the user picks a tool — **Fibonacci retracement**, **trend line**, **Fibonacci arcs**, or **parallel channel** — then draws it by dragging over the page. Drawn shapes can be repositioned by dragging their handles.

The core drawing engine (`content-scripts/content.js`) is the same as in the Firefox original. What changed in the port: the manifest was updated to MV3, the popup controller (`data/submit.js`) was rewritten to use `chrome.scripting.*`, and the retracement background images are now set via `chrome.runtime.getURL()` rather than relative CSS `url()` references (see Conventions below). An automated E2E test suite was added as part of the port.

The Firefox original is a **published, live extension** on AMO. This Chrome version is also **published, live** on the [Chrome Web Store](https://chromewebstore.google.com/detail/fibotin/hcehgkeaeecinllionmpkelhaapcobnd). Shipping a Chrome update means bumping `version` in `manifest.json`, running `npm run package`, and uploading `dist/fibotin.zip` to the Chrome Web Store developer dashboard.

## Loading and testing

**Chrome:** `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the project folder.

Debug the popup via its own devtools; debug the content script via the page devtools console (both log with `console.log`).

### Automated tests (Chrome branch only)

```bash
npm install
npm test              # unit + E2E
npm run test:unit     # manifest assertions, no browser (fast)
npm run test:e2e      # full Playwright E2E against real Chromium
npm run package       # build dist/fibotin.zip for Web Store submission
```

CI: `.github/workflows/test.yml` — runs `xvfb-run -a npm test` on Ubuntu (extensions need a display).

The test harness launches Chromium with the extension loaded via `--load-extension`. Because the real toolbar-click gesture is not automatable, the popup is opened directly as a page and `chrome.tabs.query` is stubbed to resolve to the fixture tab's ID. See `test/helpers/extension.js` for the full setup.

## Architecture (the important part)

The extension runs in **two contexts that talk over the messaging API** — understanding this split is the key to the codebase:

1. **Popup** — `data/panel.html` loads `data/menu.css` (styles the menu) and `data/submit.js` (the controller). Each menu item is an `<a>` whose `id` is the command name.
2. **Content script** — `content-scripts/content.js`, injected into the active tab, builds the drawing overlay. It is styled by `data/style.css`, which is injected **into the target page** via `tabs.insertCSS`.

**Injection is programmatic, not declarative.** There is no `content_scripts` block and no background script in `manifest.json`. Instead, every time the popup opens, `submit.js` resolves the active tab ID then calls `chrome.scripting.executeScript({target:{tabId}, files:[...]})`. `content.js` guards against repeat injection with a `window.hasRun` flag. Consequence: on privileged pages (`chrome://`, the Web Store, other extensions' pages) injection fails and the popup's buttons silently do nothing.

**Message protocol** — popup → content script via `chrome.tabs.sendMessage(tabId, {command})`, received by the single `chrome.runtime.onMessage` listener at the bottom of `content.js`. Commands: `"retracement"`, `"line"`, `"arcs"`, `"channel"`, and `"reset"` (any unrecognized command is treated as reset). On a tool command `submit.js` does: `chrome.scripting.insertCSS` → `sendMessage` → `window.close()`; on reset it does `chrome.scripting.removeCSS` → `sendMessage`.

**The overlay and its lifecycle** — `init()` creates `#base`, a full-viewport `position:fixed` div at `z-index:900000`, appended to `document.body`. While a tool is active `#base` captures all mouse events, so the underlying page is not clickable. `close()` removes `#base` and resets state. `close()` runs on **every** tool (re)selection before re-init, so **only one shape can exist on screen at a time** — re-picking a tool erases the previous drawing.

**Two-phase interaction** inside `content.js`:
- *Draw phase* (bound to `#base`): `drawStart` (mousedown) builds the shape's DOM for the current `drawSelection` → `draw` (mousemove) sizes/rotates it → `drawStop` (mouseup) detaches the draw listeners and attaches `dragStart` to the shape's handle(s).
- *Drag phase* (bound to `document`): `dragStart` records `drawObj.dragId = event.currentTarget.id` and the grab offsets, then attaches `dragGo`/`dragStop` to `document`. `dragGo` branches on `drawObj.dragId` to reposition the right shape; `dragStop` removes the document listeners. Listeners are on `document` (not the handle) so drags keep tracking when the cursor leaves the small handle.

**Shared mutable state** in `content.js`: `drawSelection` (active tool), `drawObj` (holds element references + drag-start coordinates + `dragId`), `baseElement`, `appIsOn`.

## The DOM-id ↔ CSS ↔ getElementById contract

Element `id`s created in `content.js` do triple duty: they are **CSS selectors** in `style.css`, **`getElementById` lookup keys** during dragging, and HTML ids. This makes ids a cross-file coupling that must stay **globally unique across all tools** — e.g. the arcs radius line uses `id="arcsline"` specifically so it never collides with the trend tool's `id="line"` (which `getElementById("line")` relies on during a line drag). When adding or renaming an element, update all three places together.

Per-tool ids:
- **retracement**: `#retracement` (the Fibonacci bands are rendered as repeated `data/red-dot*.PNG` background images at fixed vertical percentages in `style.css`).
- **line**: wrapper `#linebase` → `#line` + `#linecircle` (drag handle).
- **arcs**: base `#arcs` → `#circlebase` → `#circle1/2/3`, plus `#arcsline`.
- **channel**: wrapper `#channelbase` → `#channelLine`, `#secondChannelline`, `#channelcircle`, `#secondChannelCircle`.

Wrappers `#linebase` and `#channelbase` intentionally have no CSS rule — their children are `position:fixed`, so the wrappers only need to exist in the tree.

## Conventions and gotchas

- **Chrome MV3 (this branch).** Use the promise-based `chrome.*` API throughout. Injection is via `chrome.scripting.executeScript/insertCSS/removeCSS({target:{tabId}, files:[...]})` — these require the `scripting` permission (declared in `manifest.json`) and an explicit tab ID resolved before the popup closes.
- Permissions are intentionally minimal: `activeTab` + `scripting`. No host permissions in the shipped manifest. Tests add `host_permissions: http://localhost/*` and `tabs` via `buildTestExtension()` — the shipped manifest is never touched (a unit test enforces this).
- **Background images in injected CSS resolve against the page origin, not the extension origin.** Chrome's `insertCSS` resolves relative `url()` paths against the host page — so `./red-dot.PNG` becomes `http://page-origin/red-dot.PNG`, which 404s. The fix (see `content.js` and spec §6): set `backgroundImage` inline using `chrome.runtime.getURL('data/red-dot.PNG')` when creating the `#retracement` element. The `web_accessible_resources` entry in `manifest.json` is still required for the `chrome-extension://` URL to be loadable by the page.
- `style.css` is injected into arbitrary third-party pages — keep selectors id-scoped and z-index high to avoid clashing with host page styles.
- `content.js` is indented with **tabs**; match the surrounding function's style when editing.

## Known limitations (by design or unfixed)

- One shape on screen at a time (see lifecycle above); no in-page way to dismiss the overlay — it clears only on a tool switch or `reset` from the popup.
- The **arcs** shape cannot be repositioned after drawing — `dragGo` has no `"arcs"` branch.
- Popup buttons are inert on privileged pages where the content script can't be injected.
