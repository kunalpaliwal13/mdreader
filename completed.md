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
- [x] Editor line width setting (Settings → Editor), alongside the preview's
- [x] Fix: bold/italic starting with `+` (e.g. `**+ FP8**` in tables) now renders (the `++insert++` syntax is off — it caused this)
- [x] 30 smoke tests across Chromium, WebKit, Firefox

## Run 3 — editor (in progress, 2026-10-01)

- [x] Color schemes for the app and editor: Default, Obsidian, Gruvbox, Tokyo Night, Catppuccin, Nord, Solarized,
      Dracula, One Dark, Monokai, Everforest, Rosé Pine (light + dark); the preview keeps its own style
- [x] Compact Appearance panel: steppers for preview style and colors, one line-width slider scoped to
      Editor / Both / Preview; lighter default dark background
- [x] Plain editor toggle (`⌘/Ctrl+Shift+E`, pilcrow button): pauses auto-pair, wrap-selection, slash menu and
      autocomplete so pasted or hand-typed markdown is never altered
- [x] Power editing: auto-pair brackets/backticks, typing `*` `_` `~` `=` `` ` `` around a selection wraps it,
      multi-cursor (`⌘/Ctrl`-click, `Alt`-drag for columns)
- [x] Paste from web pages, Google Docs, Notion as markdown; `⌘/Ctrl+Shift+V` pastes plain text
- [x] Slash menu (`/` at line start): headings, lists, callouts, code/math/Mermaid blocks, table, details, TOC,
      links, footnote, date/time
- [x] Phone layout: top bar with file switcher, bottom bar (Files, Search, Edit/Preview, Outline, More),
      menus and panels as bottom sheets, larger touch targets
- [x] Folding: chevron beside headings, list items, code blocks and quotes on hover; Fold all / Unfold all in the
      palette (`Ctrl+Alt+[` / `]`); callouts fold in the preview by clicking their title
- [x] Table editor: type `| a | b |` + Enter to start a table; Tab / Shift-Tab / Enter move between cells and
      re-align columns (Enter returns to the column a Tab run started in; Enter on an empty last row leaves the
      table); toolbar above the table for alignment, rows and columns (insert, move, delete), Format table
- [ ] Live Preview editor

## Run 4 — linking, search, workflow (in progress, 2026-10-01)

- [x] Search like ripgrep: match case / whole word / regex toggles (`Alt+C` / `Alt+W` / `Alt+R`), every match
      highlighted, one line of context on demand, file and folder names matched too, include / exclude globs
      (with a "filtered" reminder when they're tucked away), Enter opens the top hit with the match selected
- [x] Linking: `[[note#Heading]]` opens at the heading (`[[#Heading]]` within the note), `[[note#` suggests
      headings; `![[note]]` / `![[note#Heading]]` embed a note or one section (loops and depth guarded, inlined in
      exports); `![[pic.png|300]]` and `![alt|300](pic.png)` size images; hovering a note link previews it
- [x] Tags: `#tag` / `#nested/tag` and front matter `tags:` — pills in the preview and a tint in the editor; click
      one to search it (a parent finds its children); empty Search lists every tag with counts; `#` suggests tags

## Later

- [ ] Storage fallback for private windows
- [ ] Open a real folder on disk (Chromium)
- [ ] Custom CSS and per-file theme via front matter
- [ ] Version history per file
