# mdreader

Minimal, offline markdown workspace that runs entirely in the browser. Folders and files live in the
browser's private file system (OPFS). Markdown is parsed by [comrak](https://github.com/kivikakk/comrak)
compiled to WebAssembly.

## Develop

Requires Node 20+, Rust with the `wasm32-unknown-unknown` target, and `wasm-bindgen-cli 0.2.129`.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129
npm install
npm run wasm      # build the parser into src/wasm-pkg/
npm run dev
npm run build     # wasm + production build into dist/
npx playwright install chromium webkit firefox
npm test          # smoke tests against dist/ (Chromium + WebKit + Firefox)
```
