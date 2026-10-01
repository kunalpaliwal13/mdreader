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
| Preview | **Preview** button (top right) or `⌘/Ctrl+E`; **Split** icon next to it toggles side-by-side |
| Dark / light | Sun/moon button next to Preview (System option in the gear menu) |
| Go to file | `⌘/Ctrl+P` (fuzzy) |
| Commands | `⌘/Ctrl+Shift+P`, or `⌘/Ctrl+P` then type `>` |
| Search all files | `⌘/Ctrl+Shift+F` or the Search tab; toggles for case / whole word / regex (`Alt+C/W/R`), context lines, include / exclude globs (`notes/**, *.md`); Enter opens the top hit, `↑/↓` walk results |
| Outline & backlinks | Outline tab in the sidebar |
| Link notes | `[[note]]` or `[[note\|label]]`; `[[note#Heading]]` jumps to a heading; type `[[` (or `[[note#`) for suggestions; clicking a missing note creates it; hover a link to preview the note |
| Tags | Write `#tag` or `#area/topic` (or `tags: [a, b]` in front matter); click a tag to search it; Search with nothing typed lists all tags; `#` + a letter suggests existing tags |
| Embed | `![[note]]` or `![[note#Heading]]` shows that note or section inline; `![[pic.png\|300]]` / `![alt\|300](pic.png)` set an image's width |
| Resize split | Drag the divider; double-click resets |
| Install / offline | Browser's install button (or command palette → Install); works offline after first visit |
| Sidebar | `⌘/Ctrl+\`; tree supports arrow keys, Enter, F2, Delete |
| Save now | `⌘/Ctrl+S` (autosave runs ~0.5s after typing) |
| Formatting | `⌘/Ctrl+B` bold, `⌘/Ctrl+I` italic, `⌘/Ctrl+K` link; select text and type `*` `_` `~` `=` or `` ` `` to wrap it |
| Insert blocks | Type `/` at the start of a line (headings, lists, callouts, code, math, Mermaid, table, TOC, date…) |
| Plain editor | Pilcrow button next to Preview or `⌘/Ctrl+Shift+E`: pauses auto-pair, slash menu and suggestions |
| Paste | Web pages / Docs / Notion paste as markdown; `⌘/Ctrl+Shift+V` pastes plain text |
| Multi-cursor, lines | `⌘/Ctrl`-click adds a cursor; `Alt`-drag selects a column; `Alt+↑/↓` moves lines |
| Fold | Hover a heading, list item, code block or quote and click the chevron; palette → Fold all / Unfold all; click a callout's title in the preview |
| Tables | Type `\| Name \| Age \|` and Enter; Tab / Shift-Tab / Enter move between cells and align; the toolbar above the table aligns columns and adds, moves or deletes rows and columns |
| Table of contents | Put `[[toc]]` on its own line |
| Appearance | Gear icon (bottom-left; More → Appearance on phones): preview style, font, size, line width (editor / both / preview), mode, color scheme |
| Phone | Bottom bar: Files, Search, Edit/Preview, Outline, More (Plain, theme, export, Appearance, Trash); tap the title to switch files |

Note: private/incognito windows in Safari don't provide browser storage, so files can't be saved there.
