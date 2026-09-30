# mdreader

Beautiful, minimal, feature-rich online markdown editor & viewer. Runs fully in the browser, no server,
works offline. Users manage many markdown files in folders/subfolders, edit with a real editor, see every
markdown syntax rendered, style the rendering how they like, and export to md / html / pdf.

## Stack

- Vite + TypeScript + Svelte 5
- `wasm/` — Rust crate wrapping `comrak`, compiled to WASM, runs in a Web Worker. JS post-processes
  KaTeX, Mermaid, highlight.js; DOMPurify sanitizes.
- CodeMirror 6 editor
- Storage: OPFS, accessed from a worker (sync access handles — required for Safari)

## Working rules

- Planning docs live in `docs/` (git-ignored): `docs/goals.md` holds goals + every settled decision,
  `docs/todo.md` tracks the current run. Update both as decisions are made and tasks finish.
- Work in runs split into chunks; verify each run (kitchen-sink fixture + Playwright smoke on built
  `dist/`, Chromium + WebKit + Firefox) before handing over for user testing.
- Think like a product manager before placing any control: the document is the product, chrome stays
  quiet, each action has one obvious home plus a keyboard path. Record UI reasoning in `docs/goals.md`.
- Modern, minimal look: grayscale + one accent, Inter + JetBrains Mono, thin borders, Lucide icons.
- Support Chrome, Firefox, Safari. Avoid Chromium-only APIs unless feature-detected and hidden elsewhere.

## Commands

- `npm run wasm` — build the comrak WASM package into `src/wasm-pkg/`
- `npm run dev` — dev server
- `npm run build` — wasm + production build to `dist/`
- `npm test` — Playwright smoke against `dist/`
