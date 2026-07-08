<p align="center">
  <img src="data/icon-32.png" alt="Fibotin icon" width="48" height="48">
</p>

<h1 align="center">Fibotin for Chrome</h1>

<p align="center">
  Draw Fibonacci retracements, trend lines, arcs and channels directly on top of any web page.
</p>

---

Fibotin for Chrome is a Manifest V3 Chrome extension ported from the original [Fibotin Firefox add-on](https://addons.mozilla.org/en-US/firefox/addon/fibotin/). It adds a toolbar button that lets you draw common technical-analysis tools directly over whatever page you're looking at. Draw by dragging, then nudge the shape into place by dragging its handles.

## Features

- **Fibonacci Retracement** — a box with the standard 0 %, 23.6 %, 38.2 %, 50 %, 61.8 %, 76.4 % and 100 % horizontal bands.
- **Trend Line** — a straight line with a draggable end handle.
- **Fibonacci Arcs** — concentric arcs anchored to a drawn radius line.
- **Channel** — a pair of parallel trend lines.
- **Reset** — clears the overlay and restores the page.

Works on top of any regular web page; no account, network access, or data collection.

## Installation

### Chrome Web Store

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/fibotin/hcehgkeaeecinllionmpkelhaapcobnd).

### Load unpacked (for development)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the project folder.

Reload the extension from the same page after editing any source file.

## Usage

1. Click the **Fibotin** toolbar icon to open the menu.
2. Choose a tool (Retracement, Line, Arcs, or Channel). The page shows a crosshair cursor to indicate drawing mode is active.
3. **Click and drag** on the page to draw the shape.
4. **Drag the handles** (the circles / the box) to reposition or resize.
5. Open the menu and click **Reset** to remove the overlay.

Note: only one shape is shown at a time — picking a tool again clears the previous drawing.

## Development

The extension source files are the shipped artifact — no build step is needed. Edit and reload.

- `manifest.json` — Manifest V3 for Chrome.
- `data/panel.html` + `data/menu.css` + `data/submit.js` — the toolbar popup and its controller.
- `content-scripts/content.js` — injected into the active tab; builds and manages the drawing overlay.
- `data/style.css` — styles injected into the target page for the drawn shapes.

Architecture notes, the messaging protocol between the popup and the content script, and the drawing/drag lifecycle are documented in [`CLAUDE.md`](CLAUDE.md).

### Testing

Automated E2E tests run in real Chromium via [Vitest](https://vitest.dev) and [Playwright](https://playwright.dev).

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
- The toolbar buttons have no effect on privileged pages (e.g. `chrome://` pages), where extensions cannot inject scripts.

## Origin

This project is a Chrome port of [Fibotin for Firefox](https://addons.mozilla.org/en-US/firefox/addon/fibotin/), which remains available on Firefox Add-ons. The core drawing engine is identical; only the extension API layer was updated to Manifest V3 and the `chrome.*` namespace.

## Privacy Policy

Fibotin does not collect, store, or transmit any user data. It does not use cookies, analytics, or tracking of any kind. It makes no network requests and does not communicate with any external server.

The extension only activates on the tab the user explicitly opens it on, and all processing happens locally in the browser.

## License

Released under the [MIT License](LICENSE).
