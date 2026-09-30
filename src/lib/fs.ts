import type { Ops } from './fs.worker';
export type { Entry, TrashEntry } from './fs.worker';

const worker = new Worker(new URL('./fs.worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let seq = 0;

worker.onmessage = (e) => {
  const { id, result, error } = e.data;
  const p = pending.get(id);
  pending.delete(id);
  if (error !== undefined) p?.reject(new Error(error));
  else p?.resolve(result);
};

function call<K extends keyof Ops>(op: K, ...args: Parameters<Ops[K]>): ReturnType<Ops[K]> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, op, args });
  }) as ReturnType<Ops[K]>;
}

// Typed proxy: fs.read(path), fs.write(path, data) ...
export const fs = new Proxy({} as Ops, {
  get: (_, op: keyof Ops) => (...args: any[]) => (call as any)(op, ...args),
});

export const dirname = (p: string) => p.split('/').slice(0, -1).join('/');
export const basename = (p: string) => p.split('/').pop() ?? '';
export const join = (d: string, n: string) => (d ? `${d}/${n}` : n);
export const isMarkdown = (p: string) => /\.(md|markdown|mdx|txt)$/i.test(p);
export const isImage = (p: string) => /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(p);

/** Resolve a relative link against a document's folder. Returns null for absolute/external. */
export function resolveRel(docPath: string, href: string): string | null {
  if (!href || /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) return null;
  const clean = decodeURIComponent(href.split(/[?#]/)[0]);
  const parts = dirname(docPath).split('/').filter(Boolean);
  for (const seg of clean.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}
