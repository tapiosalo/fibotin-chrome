<p align="center">
  <img src="data/icon-32.png" alt="Fibotin icon" width="48" height="48">
</p>

<h1 align="center">Fibotin</h1>

<p align="center">
  A Firefox extension for sketching technical-analysis overlays on top of any web page.
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

Fibotin is not currently published on [addons.mozilla.org](https://addons.mozilla.org), so load it as a temporary add-on:

1. Clone or download this repository.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select the `manifest.json` file from the project folder.

The Fibotin icon appears in the toolbar. Temporary add-ons are removed when Firefox restarts.

> Optional: if you have Mozilla's [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) CLI, run `web-ext run` to launch a dev browser with the extension loaded, or `web-ext build` to package a `.zip` for signing.

## Usage

1. Click the **Fibotin** toolbar icon to open the menu.
2. Choose a tool (Retracement, Line, Arcs, or Channel). The page dims to a crosshair cursor to show drawing mode is active.
3. **Click and drag** on the page to draw the shape.
4. **Drag the handles** (the circles / the box) to reposition or resize.
5. Open the menu and click **Reset** to remove the overlay.

Note: only one shape is shown at a time — picking a tool again clears the previous drawing.

## Development

No build step or dependencies — the source files are the extension. Edit the files and click **Reload** on the `about:debugging` page to pick up changes.

- `manifest.json` — extension manifest (Manifest V2).
- `data/panel.html` + `data/menu.css` + `data/submit.js` — the toolbar popup and its controller.
- `content-scripts/content.js` — injected into the active tab; builds and manages the drawing overlay.
- `data/style.css` — styles injected into the target page for the drawn shapes.

Architecture notes, the messaging protocol between the popup and the content script, and the drawing/drag lifecycle are documented in [`CLAUDE.md`](CLAUDE.md).

## Known limitations

- Only one shape can be on screen at a time.
- The **Arcs** shape can't be repositioned once drawn.
- The toolbar buttons have no effect on privileged pages (e.g. `about:` pages or `addons.mozilla.org`), where extensions cannot inject scripts.

## License

Released under the [MIT License](LICENSE).
