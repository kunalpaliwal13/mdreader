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

## Next — run 2 (planned)

- [ ] File palette (`⌘P`) and command palette (`⌘⇧P`)
- [ ] Full-text search across files
- [ ] Outline panel and editor ↔ preview scroll sync
- [ ] PWA: offline + installable
- [ ] Wikilinks and backlinks
- [ ] Resizable editor/preview split
- [ ] Storage fallback for private windows
