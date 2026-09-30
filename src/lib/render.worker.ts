/// <reference lib="webworker" />
import init, { render } from '../wasm-pkg/mdcore.js';
import wasmUrl from '../wasm-pkg/mdcore_bg.wasm?url';

const ready = init({ module_or_path: wasmUrl });

self.onmessage = async (e: MessageEvent<{ id: number; md: string }>) => {
  await ready;
  const { id, md } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, ...JSON.parse(render(md)) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
