# Completed milestones

## Run 1 — core app + all rendering (2026-09-30)

- [x] Toolchain: Vite + TypeScript + Svelte 5; Rust `comrak` crate compiled to WASM
- [x] Parser in a Web Worker: CommonMark + GFM (tables, task lists, strikethrough, autolinks), footnotes
      (incl. inline), front matter, GitHub alerts, multiline quotes, math, emoji shortcodes, definition
      lists, super/subscript, highlight, underline, insert, spoilers, heading anchors
- [x] Render pipeline: DOMPurify sanitizing, KaTeX math, Mermaid diagrams (lazy), highlight.js code,
      front-matter card, `[[toc]]`, clickable task checkboxes, code copy buttons
- [x] Storage: OPFS worker (Safari-safe sync access handles), autosave, trash with restore
- [x] File tree: create, inline rename, delete, duplicate, drag-to-move, multi-select, filter, context menu
- [x] Tabs, CodeMirror 6 editor, Edit / Split / Preview modes, status bar (save state, words, read time)
- [x] Editor UX: bold/italic/link shortcuts, list continuation, smart URL paste, image paste/drop → `assets/`
- [x] Appearance: light / dark / system; GitHub, Academic, Minimal, Sepia presets; font, size, width
- [x] Import: markdown files, folders, ZIP, drag-and-drop anywhere
- [x] Export: `.md`, standalone `.html`, PDF (print), folder / workspace ZIP
- [x] Responsive: phone (overlay sidebar, no split, touch-size targets, no iOS zoom), tablet, desktop
- [x] Smoke tests on Chromium, WebKit, Firefox (Playwright, against the production build)
- [x] GitHub Pages deploy on every push to `main`

## Run 2 — navigation, linking, offline (2026-10-01)

- [x] One-click dark/light toggle and quick Preview/Edit button next to the split toggle, with animated transitions
- [x] File palette (`⌘P`, fuzzy) and command palette (`⌘⇧P` or type `>`)
- [x] Full-text search across files (`⌘⇧F`), click a hit to jump to the line
- [x] Outline panel with current-heading highlight, plus linked mentions (backlinks)
- [x] Wikilinks `[[note]]` / `[[note|label]]`; missing notes are created on click; `[[` autocomplete
- [x] Resizable editor/preview split; scroll sync both ways
- [x] PWA: installable, works fully offline
- [x] Tree keyboard navigation (arrows, Enter, F2, Delete)
- [x] Faster first load: KaTeX and highlight.js load only when a document needs them
- [x] Fix: bold/italic starting with `+` (e.g. `**+ FP8**` in tables) now renders
- [x] 30 smoke tests across Chromium, WebKit, Firefox

## Next — run 3 (candidates)

- [ ] Base16 app/editor themes: Medusa, Gruvbox, Tokyo Night, Catppuccin, Nord, Solarized, Dracula, One Dark,
      Monokai, Everforest, Rosé Pine (light/dark variants)
- [ ] Storage fallback for private windows
- [ ] Open a real folder on disk (Chromium)
- [ ] Custom CSS and per-file theme via front matter
- [ ] Version history per file
