<p align="center">
  <img src="data/icon-32.png" alt="Fibotin icon" width="48" height="48">
</p>

<h1 align="center">Fibotin</h1>

<p align="center">
  A Firefox extension for sketching technical-analysis overlays on top of any web page.
</p>

<p align="center">
  <a href="https://addons.mozilla.org/en-US/firefox/addon/fibotin/"><b>Get it on Firefox Add-ons »</b></a>
</p>

---

Fibotin adds a toolbar button that lets you draw common charting tools — Fibonacci retracements, trend lines, Fibonacci arcs, and parallel channels — directly over whatever page you're looking at. Draw by dragging, then nudge the shape into place by dragging its handles.

## Features

- **Fibonacci Retracement** — a box with the standard horizontal retracement bands.
- **Trend Line** — a straight line with a draggable end handle.
- **Fibonacci Arcs** — concentric arcs anchored to a drawn radius line.
- **Channel** — a pair of parallel trend lines.
- **Reset** — clears the overlay and restores the page.

Works on top of any regular web page; no account, network access, or data collection.

## Installation

Install the published version from Firefox Add-ons:

**[Get Fibotin on addons.mozilla.org »](https://addons.mozilla.org/en-US/firefox/addon/fibotin/)**

The Fibotin icon appears in the toolbar once installed.

### From source (Firefox — for development)

1. Clone or download this repository.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select the `manifest.json` file from the project folder.

Temporary add-ons are removed when Firefox restarts.

> Optional: if you have Mozilla's [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) CLI, run `web-ext run` to launch a dev browser with the extension loaded, or `web-ext build` to package a `.zip` for signing.

### From source (Chrome — for development)

The `chrome-mv3-port` branch contains a Manifest V3 build for Chrome:

1. Clone the repository and check out the `chrome-mv3-port` branch.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the project folder.

Reload the extension from the same page after editing any source file.

## Usage

1. Click the **Fibotin** toolbar icon to open the menu.
2. Choose a tool (Retracement, Line, Arcs, or Channel). The page dims to a crosshair cursor to show drawing mode is active.
3. **Click and drag** on the page to draw the shape.
4. **Drag the handles** (the circles / the box) to reposition or resize.
5. Open the menu and click **Reset** to remove the overlay.

Note: only one shape is shown at a time — picking a tool again clears the previous drawing.

## Development

The extension source files are the shipped artifact — no build step is needed. Edit and reload.

- `manifest.json` — extension manifest (MV2 on `master` / Firefox; MV3 on `chrome-mv3-port`).
- `data/panel.html` + `data/menu.css` + `data/submit.js` — the toolbar popup and its controller.
- `content-scripts/content.js` — injected into the active tab; builds and manages the drawing overlay.
- `data/style.css` — styles injected into the target page for the drawn shapes.

Architecture notes, the messaging protocol between the popup and the content script, and the drawing/drag lifecycle are documented in [`CLAUDE.md`](CLAUDE.md).

### Testing (Chrome MV3 branch)

The `chrome-mv3-port` branch has an automated E2E test suite powered by [Vitest](https://vitest.dev) and [Playwright](https://playwright.dev).

```bash
npm install
npm test              # unit + E2E (all tests)
npm run test:unit     # manifest assertions only (fast, no browser)
npm run test:e2e      # full E2E in real Chromium
npm run package       # produce dist/fibotin.zip for Web Store submission
```

CI runs automatically on every push via GitHub Actions (`.github/workflows/test.yml`).

## Known limitations

- Only one shape can be on screen at a time.
- The **Arcs** shape can't be repositioned once drawn.
- The toolbar buttons have no effect on privileged pages (e.g. `about:` pages or `addons.mozilla.org`), where extensions cannot inject scripts.

## License

Released under the [MIT License](LICENSE).
