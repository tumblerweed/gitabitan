# গীতবিতান — Gitabitan (Offline)

Rabindranath Tagore's Gitabitan — a complete, searchable collection of ~1,905 songs.

This is the self-hosting bundle. Everything runs in your browser — no internet required.

## Quick Start

You need a static file server. Pick whichever you have:

**Python** (most systems have this):
```
python3 -m http.server 8080
```

**Node.js**:
```
npx serve -p 8080
```

Then open **http://localhost:8080** in your browser.

## Requirements

- A modern browser (Chrome, Firefox, Safari, Edge)
- WebAssembly support (all modern browsers have this)

## What's Included

- `index.html` — the app
- `js/` — application logic, search engine, Bengali keyboard
- `css/` — styles
- `gitabitan.db` — SQLite database (~10 MB, loaded in-browser via WASM)
- `vendor/` — sql.js library (SQLite compiled to WebAssembly)
