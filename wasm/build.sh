#!/bin/sh
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir ../src/wasm-pkg target/wasm32-unknown-unknown/release/mdcore.wasm
