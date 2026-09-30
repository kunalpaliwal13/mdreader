import DOMPurify from 'dompurify';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import { fs, resolveRel, isImage } from './fs';

export type Heading = { level: number; text: string; id: string };
export type Parsed = { html: string; front_matter: string | null; headings: Heading[] };

const worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, (p: Parsed) => void>();
let seq = 0;
const failed = (msg: string): Parsed => ({ html: `<pre class="render-error">${msg}</pre>`, front_matter: null, headings: [] });
worker.onerror = (e) => {
  // e.g. the wasm failed to load: resolve everything waiting instead of hanging the preview
  for (const resolve of pending.values()) resolve(failed(`Renderer failed to start: ${e.message ?? 'unknown error'}`));
  pending.clear();
};
worker.onmessage = (e) => {
  const { id, error, ...parsed } = e.data;
  pending.get(id)?.(error ? failed(escapeHtml(error)) : parsed);
  pending.delete(id);
};

export function parse(md: string): Promise<Parsed> {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    worker.postMessage({ id, md });
  });
}

// --- asset blob URLs (cached; invalidated when a file is written/moved) ---
const blobs = new Map<string, string>();
export function invalidateAsset(path?: string) {
  for (const [k, url] of blobs) {
    if (!path || k === path || k.startsWith(path + '/')) {
      URL.revokeObjectURL(url);
      blobs.delete(k);
    }
  }
}
async function assetUrl(path: string): Promise<string | null> {
  if (blobs.has(path)) return blobs.get(path)!;
  try {
    const buf = await fs.readBytes(path);
    const type = path.endsWith('.svg') ? 'image/svg+xml' : '';
    const url = URL.createObjectURL(new Blob([buf], { type }));
    blobs.set(path, url);
    return url;
  } catch {
    return null;
  }
}

// --- mermaid (lazy, cached by source + theme) ---
const mermaidCache = new Map<string, string>();
let mermaidP: Promise<typeof import('mermaid').default> | null = null;
let mermaidTheme = '';
let mermaidSeq = 0;
async function renderMermaid(code: string, dark: boolean): Promise<string> {
  const theme = dark ? 'dark' : 'neutral';
  const key = theme + '\0' + code;
  if (mermaidCache.has(key)) return mermaidCache.get(key)!;
  const m = await (mermaidP ??= import('mermaid').then((x) => x.default));
  if (mermaidTheme !== theme) {
    m.initialize({ startOnLoad: false, securityLevel: 'strict', theme, fontFamily: 'inherit' });
    mermaidTheme = theme;
  }
  let svg: string;
  try {
    svg = (await m.render(`mmd-${++mermaidSeq}`, code)).svg;
  } catch (err) {
    svg = `<pre class="render-error">Mermaid: ${escapeHtml((err as Error).message ?? String(err))}</pre>`;
    document.getElementById(`dmmd-${mermaidSeq}`)?.remove();
  }
  if (mermaidCache.size > 200) mermaidCache.clear();
  mermaidCache.set(key, svg);
  return svg;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ponytail: flat "key: value" front matter (+ inline/dash lists); swap in a YAML parser if nested metadata matters
function frontMatterCard(fm: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'front-matter';
  const dl = document.createElement('dl');
  const unquote = (v: string) => v.trim().replace(/^["']|["']$/g, '');
  const chip = (dd: HTMLElement, v: string) => {
    const c = document.createElement('span');
    c.className = 'fm-chip';
    c.textContent = unquote(v);
    dd.append(c);
  };
  let lastDd: HTMLElement | null = null;
  for (const line of fm.split('\n')) {
    const m = line.match(/^([\w.-]+)\s*:\s*(.*)$/);
    if (m) {
      const dt = document.createElement('dt');
      dt.textContent = m[1];
      lastDd = document.createElement('dd');
      const v = m[2].trim();
      if (/^\[.*\]$/.test(v)) v.slice(1, -1).split(',').filter((x) => x.trim()).forEach((x) => chip(lastDd!, x));
      else lastDd.textContent = unquote(v);
      dl.append(dt, lastDd);
    } else if (lastDd && /^\s*-\s+/.test(line)) {
      chip(lastDd, line.replace(/^\s*-\s+/, ''));
    } else if (lastDd && line.trim()) {
      lastDd.append(' ' + line.trim());
    }
  }
  card.append(dl);
  return card;
}

function toc(headings: Heading[]): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'toc';
  const min = Math.min(...headings.map((h) => h.level));
  for (const h of headings) {
    const a = document.createElement('a');
    a.href = '#user-content-' + h.id;
    a.textContent = h.text;
    a.style.paddingLeft = `${(h.level - min) * 14}px`;
    nav.append(a);
  }
  return nav;
}

export type RenderOpts = { docPath: string; dark: boolean; forExport?: boolean };

/**
 * Parse + sanitize + enhance into a fresh element (not attached).
 * `pending` settles once slow parts (uncached mermaid, images) have filled in — the element
 * can be shown before that.
 */
export async function renderToElement(md: string, opts: RenderOpts): Promise<{ el: HTMLElement; parsed: Parsed; pending: Promise<unknown> }> {
  const parsed = await parse(md);
  const el = document.createElement('div');
  el.innerHTML = DOMPurify.sanitize(parsed.html, {
    ADD_ATTR: ['lang', 'data-sourcepos', 'data-math-style'],
  });

  if (parsed.front_matter) el.prepend(frontMatterCard(parsed.front_matter));

  // [[toc]] or [TOC] placeholder paragraphs
  for (const p of el.querySelectorAll('p')) {
    if (/^\s*\[(\[toc\]|toc)\]\s*$/i.test(p.textContent ?? '')) p.replaceWith(toc(parsed.headings));
  }

  // math: inline spans and display blocks (```math or $$)
  for (const node of el.querySelectorAll<HTMLElement>('[data-math-style], pre[lang="math"]')) {
    const display = node.dataset.mathStyle === 'display' || node.tagName === 'PRE';
    const holder = document.createElement(display ? 'div' : 'span');
    holder.className = display ? 'math-display' : 'math-inline';
    holder.innerHTML = katex.renderToString(node.textContent ?? '', { displayMode: display, throwOnError: false });
    node.replaceWith(holder);
  }

  // mermaid + code highlighting
  const jobs: Promise<void>[] = [];
  for (const pre of el.querySelectorAll<HTMLElement>('pre')) {
    const lang = (pre.getAttribute('lang') ?? '').toLowerCase();
    const code = pre.querySelector('code');
    if (!code) continue;
    if (lang === 'mermaid') {
      const div = document.createElement('div');
      div.className = 'mermaid';
      pre.replaceWith(div);
      const src = code.textContent ?? '';
      const hit = mermaidCache.get((opts.dark ? 'dark' : 'neutral') + '\0' + src);
      if (hit) div.innerHTML = hit;
      else jobs.push(renderMermaid(src, opts.dark).then((svg) => void (div.innerHTML = svg)));
      continue;
    }
    if (lang && hljs.getLanguage(lang)) {
      code.innerHTML = hljs.highlight(code.textContent ?? '', { language: lang, ignoreIllegals: true }).value;
    }
    code.classList.add('hljs');
    if (lang) pre.dataset.lang = lang;
    if (!opts.forExport) {
      const btn = document.createElement('button');
      btn.className = 'code-copy';
      btn.type = 'button';
      btn.textContent = 'Copy';
      pre.append(btn);
    }
  }

  // relative images -> OPFS blob URLs
  for (const img of el.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? '';
    const path = resolveRel(opts.docPath, src);
    if (path && isImage(path) && blobs.has(path)) img.src = blobs.get(path)!;
    else if (path && isImage(path)) {
      jobs.push(
        assetUrl(path).then((url) => {
          if (url) img.src = url;
          else img.classList.add('broken');
        }),
      );
    }
    img.loading = 'lazy';
  }

  // external links open in a new tab; #frag points at the prefixed heading id when that's what exists
  for (const a of el.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')!;
    if (href.length > 1 && href.startsWith('#') && !href.startsWith('#user-content-')) {
      const id = decodeURIComponent(href.slice(1));
      if (!el.querySelector(`[id="${CSS.escape(id)}"]`) && el.querySelector(`[id="user-content-${CSS.escape(id)}"]`))
        a.setAttribute('href', '#user-content-' + id);
    }
    if (/^https?:/i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }

  return { el, parsed, pending: Promise.all(jobs) };
}
