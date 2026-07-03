# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fibotin is a Mozilla Firefox WebExtension (Manifest V2) that overlays technical-analysis drawing tools on top of any web page. From a toolbar popup the user picks a tool — **Fibonacci retracement**, **trend line**, **Fibonacci arcs**, or **parallel channel** — then draws it by dragging over the page. Drawn shapes can be repositioned by dragging their handles. There is no build step, no dependencies, and no test suite; the source files are the shipped artifact.

## Loading and testing

There is no package manager or build tooling. Load the unpacked extension directly:

- Firefox → `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.
- Reload after edits with the **Reload** button on that page (or restart if the popup/manifest changed).
- Debug the **popup** (submit.js) via its own devtools; debug the **content script** (content.js) via the page's devtools console — both log liberally with `console.log`.

Optional, if you have Mozilla's `web-ext` CLI installed globally (not configured in this repo): `web-ext run` to launch, `web-ext lint` to validate the manifest, `web-ext build` to package a `.zip`. Nothing in the repo depends on it.

## Architecture (the important part)

The extension runs in **two contexts that talk over the messaging API** — understanding this split is the key to the codebase:

1. **Popup** — `data/panel.html` loads `data/menu.css` (styles the menu) and `data/submit.js` (the controller). Each menu item is an `<a>` whose `id` is the command name.
2. **Content script** — `content-scripts/content.js`, injected into the active tab, builds the drawing overlay. It is styled by `data/style.css`, which is injected **into the target page** via `tabs.insertCSS`.

**Injection is programmatic, not declarative.** There is no `content_scripts` block and no background script in `manifest.json`. Instead, every time the popup opens, `submit.js` runs `browser.tabs.executeScript({file: "/content-scripts/content.js"})`, then wires up its click handler in the `.then()`. `content.js` guards against repeat injection with a `window.hasRun` flag. Consequence: on privileged pages (`about:`, `addons.mozilla.org`, `view-source:`) injection fails and the popup's buttons silently do nothing.

**Message protocol** — popup → content script via `browser.tabs.sendMessage({command})`, received by the single `browser.runtime.onMessage` listener at the bottom of `content.js`. Commands: `"retracement"`, `"line"`, `"arcs"`, `"channel"`, and `"reset"` (any unrecognized command is treated as reset). On a tool command `submit.js` does: `insertCSS(style.css)` → `sendMessage` → `window.close()`; on reset it does `removeCSS(style.css)` → `sendMessage`.

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

- **Manifest V2 / Firefox only.** Prefer the promise-based `browser.*` API with `.catch` (as `submit.js` uses) over `chrome.*` callbacks. Migrating to MV3 would require `browser_action`→`action`, `executeScript`/`insertCSS`→the `scripting` API, and an object-form `web_accessible_resources`.
- Permissions are intentionally minimal: only `activeTab` (sufficient for `executeScript`/`insertCSS`/`sendMessage` on the current tab). `style.css` and `content.js` are loaded from the package by the extension, so they do **not** need `web_accessible_resources`.
- `style.css` is injected into arbitrary third-party pages — keep selectors id-scoped and z-index high to avoid clashing with host page styles.
- `content.js` is indented with **tabs**; match the surrounding function's style when editing.

## Known limitations (by design or unfixed)

- One shape on screen at a time (see lifecycle above); no in-page way to dismiss the overlay — it clears only on a tool switch or `reset` from the popup.
- The **arcs** shape cannot be repositioned after drawing — `dragGo` has no `"arcs"` branch.
- Popup buttons are inert on privileged pages where the content script can't be injected.
