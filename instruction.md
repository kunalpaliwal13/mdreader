# How to run mdreader

## Use it online

- https://sandptel.github.io/mdreader/ (fork `sandptel/mdreader`)
- https://kunalpaliwal13.github.io/mdreader/ (upstream — live once Pages is enabled there: Settings → Pages →
  Source: GitHub Actions)

Each repo rebuilds and redeploys automatically on every push to its `main` (`.github/workflows/pages.yml`). Everything runs in your browser; files are stored in the browser's
private file system (OPFS) and never leave your device.

## Run locally

### Prerequisites

- Node.js 20.19+ (22+ recommended) and npm
- Rust (stable) with the WebAssembly target and `wasm-bindgen` CLI **0.2.129** (must match the crate):

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129
```

### Start

```sh
git clone https://github.com/kunalpaliwal13/mdreader.git
cd mdreader
npm install
npm run wasm        # compile the comrak parser to WASM (src/wasm-pkg/)
npm run dev         # http://localhost:5173
```

### Production build

```sh
npm run build       # wasm + vite build into dist/
npm run preview     # serve dist/ at http://localhost:4173
```

`dist/` is a static site — host it anywhere (it uses relative paths, so any sub-folder works).

### Tests

```sh
npx playwright install chromium webkit firefox   # once
npm run build && npm test                        # smoke tests against dist/
```

## Using the app

| Action | How |
|---|---|
| New file / folder | Sidebar header icons, or right-click in the tree |
| Rename | Double-click, `F2`, or `⋯` → Rename |
| Move | Drag onto a folder (drop on empty space = workspace root) |
| Multi-select | `⌘/Ctrl`-click, `Shift`-click |
| Delete / restore | `Delete` key or menu → Trash (bottom-left) → Restore |
| Import | Sidebar import icon: markdown files, a folder, or a `.zip`; or drop files anywhere |
| Export | Download icon next to the tabs: `.md`, `.html`, PDF; folder → ZIP from its menu |
| Images | Paste or drop into the editor — saved to `assets/` next to the file |
| View mode | Edit / Split / Preview toggle, or `⌘/Ctrl+E` |
| Sidebar | `⌘/Ctrl+\` |
| Save now | `⌘/Ctrl+S` (autosave runs ~0.5s after typing) |
| Formatting | `⌘/Ctrl+B` bold, `⌘/Ctrl+I` italic, `⌘/Ctrl+K` link |
| Table of contents | Put `[[toc]]` on its own line |
| Appearance | Gear icon: theme, preview style, font, size, width |

Note: private/incognito windows in Safari don't provide browser storage, so files can't be saved there.
