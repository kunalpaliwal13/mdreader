// Import (files / folders / zip / drag-drop) and export (md / html / pdf / zip).
import { zipSync, unzipSync, strToU8 } from 'fflate';
import previewCss from '../preview.css?raw';
import { fs, basename, isMarkdown, type Entry } from './fs';
import { renderToElement } from './render';
import { app } from './app.svelte';

type InFile = { path: string; data: ArrayBuffer | string };

// ---------- import ----------

function pick(opts: { multiple?: boolean; accept?: string; folder?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = !!opts.multiple;
    if (opts.accept) input.accept = opts.accept;
    if (opts.folder) input.webkitdirectory = true;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.oncancel = () => resolve([]);
    input.click();
  });
}

const importable = (p: string) => isMarkdown(p) || /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|pdf)$/i.test(p);

async function unzip(file: Blob): Promise<InFile[]> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  return Object.entries(entries)
    .filter(([p]) => !p.endsWith('/') && importable(p))
    .map(([path, bytes]) => ({ path, data: bytes.slice().buffer }));
}

async function fromFiles(files: File[], relative = (f: File) => f.name): Promise<InFile[]> {
  const out: InFile[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) out.push(...(await unzip(f)));
    else if (importable(f.name)) out.push({ path: relative(f), data: await f.arrayBuffer() });
  }
  return out;
}

export async function importPicker(kind: 'files' | 'folder' | 'zip', dest = '') {
  const files =
    kind === 'folder'
      ? await pick({ folder: true })
      : await pick({ multiple: true, accept: kind === 'zip' ? '.zip' : '.md,.markdown,.txt,.zip,image/*' });
  if (!files.length) return;
  const items = await fromFiles(files, (f) => f.webkitRelativePath || f.name);
  if (!items.length) return app.notify('No markdown or image files found', 'error');
  await app.importFiles(items, dest);
}

// Walk dropped folders via the (widely supported) webkitGetAsEntry API.
async function readEntry(entry: FileSystemEntry, prefix: string, out: File[], paths: string[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push(file);
    paths.push(prefix + file.name);
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const e of batch) await readEntry(e, `${prefix}${entry.name}/`, out, paths);
    } while (batch.length);
  }
}

export const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

export async function importDrop(dt: DataTransfer, dest = '') {
  const files: File[] = [];
  const paths: string[] = [];
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
  if (entries.length) for (const e of entries) await readEntry(e, '', files, paths);
  else files.push(...dt.files), paths.push(...[...dt.files].map((f) => f.name));
  const byFile = new Map(files.map((f, i) => [f, paths[i]]));
  const items = await fromFiles(files, (f) => byFile.get(f) ?? f.name);
  if (!items.length) return app.notify('No markdown or image files found', 'error');
  await app.importFiles(items, dest);
}

// ---------- export ----------

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stem = (p: string) => basename(p).replace(/\.[^.]+$/, '');

export async function exportMd(path: string) {
  await app.flush(path);
  const data = path in app.texts ? app.texts[path] : await fs.readBytes(path);
  download(basename(path), data, isMarkdown(path) ? 'text/markdown' : 'application/octet-stream');
}

async function toDataUrl(src: string): Promise<string> {
  const blob = await (await fetch(src)).blob();
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });
}

function previewClasses() {
  const s = app.settings;
  return `md preset-${s.preset}${s.font === 'preset' ? '' : ' font-' + s.font}`;
}

/** Self-contained HTML: rendered content + preview CSS; local images inlined. */
async function standaloneHtml(path: string, forPrint: boolean): Promise<string> {
  const { el, pending } = await renderToElement(app.texts[path] ?? (await fs.read(path)), { docPath: path, dark: false, forExport: true });
  await pending;
  for (const img of el.querySelectorAll('img')) {
    if (img.src.startsWith('blob:')) img.src = await toDataUrl(img.src);
    img.removeAttribute('loading');
  }
  el.querySelectorAll('input[type=checkbox]').forEach((i) => i.setAttribute('disabled', ''));
  // KaTeX CSS is linked from a CDN in exports (fonts would add ~1MB if inlined)
  const katexHref = 'https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.css';
  const s = app.settings;
  const title = stem(path).replace(/[<&]/g, '');
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="${katexHref}">
<style>
html,body{margin:0;background:#fff}
${previewCss}
${forPrint ? '@page{margin:18mm 16mm}' : ''}
</style>
</head>
<body>
<article class="${previewClasses()}" style="--pv-size:${s.size}px;--pv-width:${s.width}px">
${el.innerHTML}
</article>
</body>
</html>`;
}

export async function exportHtml(path: string) {
  download(stem(path) + '.html', await standaloneHtml(path, false), 'text/html');
}

/** Print the standalone HTML from a hidden iframe (no popup, no app chrome, multi-page). */
export async function exportPdf(path: string) {
  const html = await standaloneHtml(path, true);
  const frame = Object.assign(document.createElement('iframe'), { srcdoc: html });
  // real size offscreen: Firefox/Safari can print blank pages from 0×0 or hidden frames
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0';
  document.body.append(frame);
  frame.onload = async () => {
    const w = frame.contentWindow!;
    await w.document.fonts?.ready;
    // document title becomes the default PDF filename
    const prev = document.title;
    document.title = stem(path);
    w.focus();
    w.print();
    document.title = prev;
    setTimeout(() => frame.remove(), 1000);
  };
}

/** ZIP a folder ('' = whole workspace). */
export async function exportZip(dir: string) {
  const files = app.entries.filter((e: Entry) => e.kind === 'file' && (!dir || e.path.startsWith(dir + '/')));
  await app.flush();
  const tree: Record<string, Uint8Array> = {};
  const strip = dir ? dir.length + 1 : 0;
  for (const f of files) tree[f.path.slice(strip)] = new Uint8Array(await fs.readBytes(f.path));
  if (!files.length) tree['README.md'] = strToU8('');
  download((dir ? basename(dir) : 'workspace') + '.zip', zipSync(tree, { level: 6 }), 'application/zip');
}
