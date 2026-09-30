/// <reference lib="webworker" />
// All OPFS access lives here: Safari only supports writes through
// createSyncAccessHandle, which exists only in dedicated workers.

export type Entry = { path: string; kind: 'file' | 'dir' };
export type TrashEntry = { id: string; path: string; kind: 'file' | 'dir'; deletedAt: number };

const TRASH = '.trash';
let rootP: Promise<FileSystemDirectoryHandle> | null = null;
const root = () => (rootP ??= navigator.storage.getDirectory());

const split = (p: string) => p.split('/').filter(Boolean);

async function dir(path: string, create = false): Promise<FileSystemDirectoryHandle> {
  let d = await root();
  for (const part of split(path)) d = await d.getDirectoryHandle(part, { create });
  return d;
}

function parentAndName(path: string): [string, string] {
  const parts = split(path);
  const name = parts.pop();
  if (!name) throw new Error('Invalid path');
  return [parts.join('/'), name];
}

async function handle(path: string): Promise<FileSystemHandle> {
  const [p, name] = parentAndName(path);
  const d = await dir(p);
  try {
    return await d.getFileHandle(name);
  } catch {
    return await d.getDirectoryHandle(name);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await handle(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(d: FileSystemDirectoryHandle, prefix: string, out: Entry[]) {
  // @ts-ignore entries() is missing from older lib.dom typings
  for await (const [name, h] of d.entries() as AsyncIterable<[string, FileSystemHandle]>) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (h.kind === 'directory') {
      out.push({ path, kind: 'dir' });
      await walk(h as FileSystemDirectoryHandle, path, out);
    } else out.push({ path, kind: 'file' });
  }
}

async function list(): Promise<Entry[]> {
  const out: Entry[] = [];
  await walk(await root(), '', out);
  return out.filter((e) => !e.path.split('/').some((p) => p.startsWith('.')));
}

async function readBytes(path: string): Promise<ArrayBuffer> {
  const [p, name] = parentAndName(path);
  const f = await (await (await dir(p)).getFileHandle(name)).getFile();
  return f.arrayBuffer();
}

async function read(path: string): Promise<string> {
  return new TextDecoder().decode(await readBytes(path));
}

async function write(path: string, data: string | ArrayBuffer) {
  const [p, name] = parentAndName(path);
  const fh = await (await dir(p, true)).getFileHandle(name, { create: true });
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const h = await fh.createSyncAccessHandle();
  try {
    // write first, then trim: an interrupted save never leaves an empty file
    h.write(bytes, { at: 0 });
    h.truncate(bytes.length);
    h.flush();
  } finally {
    h.close();
  }
}

async function mkdir(path: string) {
  await dir(path, true);
}

async function copy(from: string, to: string) {
  const h = await handle(from);
  if (h.kind === 'file') return write(to, await readBytes(from));
  await mkdir(to);
  // @ts-ignore
  for await (const name of (h as FileSystemDirectoryHandle).keys() as AsyncIterable<string>)
    await copy(`${from}/${name}`, `${to}/${name}`);
}

async function removeRaw(path: string) {
  const [p, name] = parentAndName(path);
  await (await dir(p)).removeEntry(name, { recursive: true });
}

// FileSystemHandle.move() is Chromium-only, so move = copy + delete.
async function move(from: string, to: string) {
  if (from === to) return;
  if (to.startsWith(from + '/')) throw new Error('Cannot move a folder into itself');
  if (await exists(to)) throw new Error(`"${to}" already exists`);
  await copy(from, to);
  await removeRaw(from);
}

// Trash layout: .trash/<timestamp>~<encoded original path>/<name>
async function trash(path: string) {
  const [, name] = parentAndName(path);
  const id = `${Date.now()}${Math.random().toString(36).slice(2, 6)}~${encodeURIComponent(path)}`;
  await move(path, `${TRASH}/${id}/${name}`);
}

async function listTrash(): Promise<TrashEntry[]> {
  const t = await dir(TRASH, true);
  const out: TrashEntry[] = [];
  // @ts-ignore
  for await (const [id, h] of t.entries() as AsyncIterable<[string, FileSystemDirectoryHandle]>) {
    const [stamp, enc] = id.split('~');
    const path = decodeURIComponent(enc ?? '');
    // @ts-ignore
    for await (const [, item] of h.entries() as AsyncIterable<[string, FileSystemHandle]>)
      out.push({ id, path, kind: item.kind === 'directory' ? 'dir' : 'file', deletedAt: parseInt(stamp) });
  }
  return out.sort((a, b) => b.deletedAt - a.deletedAt);
}

async function uniquePath(path: string): Promise<string> {
  if (!(await exists(path))) return path;
  const [p, name] = parentAndName(path);
  const dot = name.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let i = 1; ; i++) {
    const c = (p ? p + '/' : '') + `${base} ${i}${ext}`;
    if (!(await exists(c))) return c;
  }
}

async function restore(id: string): Promise<string> {
  const path = decodeURIComponent(id.split('~')[1] ?? '');
  const [, name] = parentAndName(path);
  const target = await uniquePath(path);
  await move(`${TRASH}/${id}/${name}`, target);
  await removeRaw(`${TRASH}/${id}`);
  return target;
}

async function purge(id: string) {
  await removeRaw(`${TRASH}/${id}`);
}

async function emptyTrash() {
  if (await exists(TRASH)) await removeRaw(TRASH);
}

const ops = { list, read, readBytes, write, mkdir, move, copy, trash, listTrash, restore, purge, emptyTrash, exists, uniquePath };
export type Ops = typeof ops;

// Serialize everything: sync access handles are exclusive per file.
let queue: Promise<unknown> = Promise.resolve();
self.onmessage = (e: MessageEvent<{ id: number; op: keyof Ops; args: unknown[] }>) => {
  const { id, op, args } = e.data;
  queue = queue.then(async () => {
    try {
      // @ts-ignore dynamic dispatch
      const result = await ops[op](...args);
      const transfer = result instanceof ArrayBuffer ? [result] : [];
      (self as unknown as Worker).postMessage({ id, result }, transfer);
    } catch (err) {
      (self as unknown as Worker).postMessage({ id, error: (err as Error).message ?? String(err) });
    }
  });
};
