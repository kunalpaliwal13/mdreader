import DOMPurify from 'dompurify';
import { fs, resolveRel, isImage, basename } from './fs';
import { headingKey, splitTarget } from './headings';
import { TAG } from './tags';

// heavy renderers load only when a document needs them
let katexP: Promise<typeof import('katex').default> | null = null;
let hljsP: Promise<typeof import('highlight.js/lib/common').default> | null = null;
const getKatex = () => (katexP ??= import('katex').then((m) => m.default));
const getHljs = () => (hljsP ??= import('highlight.js/lib/common').then((m) => m.default));

export type Heading = { level: number; line: number; text: string; id: string };
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
  let key = '';
  const chip = (dd: HTMLElement, v: string) => {
    // tags are clickable, like inline #tags
    const isTag = /^tags?$/i.test(key);
    const c = document.createElement(isTag ? 'a' : 'span');
    c.className = isTag ? 'fm-chip tag' : 'fm-chip';
    c.textContent = unquote(v).replace(/^#/, '');
    if (isTag) (c as HTMLAnchorElement).href = '#', (c.dataset.tag = c.textContent.toLowerCase());
    dd.append(c);
  };
  let lastDd: HTMLElement | null = null;
  for (const line of fm.split('\n')) {
    const m = line.match(/^([\w.-]+)\s*:\s*(.*)$/);
    if (m) {
      const dt = document.createElement('dt');
      dt.textContent = key = m[1];
      lastDd = document.createElement('dd');
      const v = m[2].trim();
      if (/^\[.*\]$/.test(v)) v.slice(1, -1).split(',').filter((x) => x.trim()).forEach((x) => chip(lastDd!, x));
      else if (/^tags?$/i.test(key) && v) v.split(/[,\s]+/).filter(Boolean).forEach((x) => chip(lastDd!, x));
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

export type RenderOpts = {
  docPath: string;
  dark: boolean;
  forExport?: boolean;
  /** [[wikilink]] target -> workspace path (resolved from the document `from`), or null when no such file exists */
  resolveWiki?: (target: string, from: string) => string | null;
  /** a workspace file's text, for ![[embeds]]; without it embeds are plain links */
  readNote?: (path: string) => Promise<string>;
  /** "path#heading" of the embeds being rendered around this one (cycle + depth guard) */
  chain?: string[];
};

// ---- per-note look from front matter: `preset: academic`, `font: serif` ----
const PRESETS = ['github', 'academic', 'minimal', 'sepia'];
const FONTS = ['sans', 'serif', 'mono'];
export type DocStyle = { preset?: string; font?: string };
export function frontMatterStyle(fm: string | null): DocStyle {
  const get = (k: string) => fm?.match(new RegExp(`^${k}\\s*:\\s*["']?([\\w-]+)`, 'mi'))?.[1]?.toLowerCase() ?? '';
  const preset = get('preset'), font = get('font');
  return { preset: PRESETS.includes(preset) ? preset : undefined, font: FONTS.includes(font) ? font : undefined };
}

// ---- ![[embeds]]: notes, note sections and images (comrak leaves the syntax as text) ----
const EMBED = /!\[\[([^\]\n]+)\]\]/g;
const MAX_DEPTH = 3;
// finished embed bodies (images + diagrams filled in), cloned on reuse so typing in the host doesn't flicker
const embedCache = new Map<string, HTMLElement>();

function wikiAnchor(target: string) {
  const a = document.createElement('a');
  a.dataset.wikilink = 'true';
  a.setAttribute('href', encodeURIComponent(target));
  a.textContent = target;
  return a; // resolved + labelled by the wikilink pass below
}

/** The heading matching `heading` and everything up to the next heading of the same or higher level. */
export function section(root: HTMLElement, parsed: Parsed, heading: string): Node[] | null {
  if (!heading) return [...root.childNodes];
  const h = parsed.headings.find((x) => headingKey(x.text) === headingKey(heading));
  const start = h && root.querySelector(`[id="user-content-${CSS.escape(h.id)}"]`)?.closest('h1, h2, h3, h4, h5, h6');
  if (!start) return null;
  const out: Node[] = [start];
  for (let n = start.nextSibling; n; n = n.nextSibling) {
    if (/^H[1-6]$/.test((n as Element).tagName ?? '') && +(n as Element).tagName[1] <= +start.tagName[1]) break;
    out.push(n);
  }
  return out;
}

async function fillEmbed(box: HTMLElement, path: string, heading: string, key: string, opts: RenderOpts) {
  const text = await opts.readNote!(path);
  const ck = [path, heading, opts.dark, !!opts.forExport, text].join('\0');
  const hit = embedCache.get(ck);
  if (hit) return void box.append(hit.cloneNode(true));
  const sub = await renderToElement(text, { ...opts, docPath: path, chain: [...(opts.chain ?? [opts.docPath + '#']), key] });
  const body = document.createElement('div');
  body.className = 'embed-body';
  const nodes = section(sub.el, sub.parsed, heading);
  if (nodes) body.append(...nodes);
  else body.append(Object.assign(document.createElement('p'), { className: 'embed-missing', textContent: `No heading “${heading}” in this note` }));
  // the host owns line numbers (scroll sync, task toggles) and ids (#anchors)
  for (const n of body.querySelectorAll('[data-sourcepos], [id]')) n.removeAttribute('data-sourcepos'), n.removeAttribute('id');
  box.append(body);
  sub.pending.then(() => {
    embedCache.set(ck, body.cloneNode(true) as HTMLElement);
    if (embedCache.size > 40) embedCache.delete(embedCache.keys().next().value!);
  });
}

function embedNode(raw: string, opts: RenderOpts, jobs: Promise<void>[]): Node {
  const [name, size = ''] = raw.split('|'); // ![[pic.png|300]] / ![[pic.png|300x200]]; a note alias is ignored
  const [note, heading] = splitTarget(name);
  const path = note ? (opts.resolveWiki?.(note, opts.docPath) ?? null) : opts.docPath;
  if (path && isImage(path)) {
    const img = document.createElement('img');
    img.alt = basename(path);
    img.dataset.asset = path;
    const m = /^(\d+)(?:x(\d+))?$/.exec(size.trim());
    if (m) (img.width = +m[1]), m[2] && (img.height = +m[2]);
    return img;
  }
  const key = `${path}#${headingKey(heading)}`;
  const chain = opts.chain ?? [opts.docPath + '#'];
  if (!path || !opts.readNote || chain.includes(key) || chain.length > MAX_DEPTH) return wikiAnchor(name.trim());
  const box = document.createElement('div');
  box.className = 'embed';
  if (!opts.forExport) {
    const title = document.createElement('div');
    title.className = 'embed-title';
    title.append(wikiAnchor(name.trim()));
    box.append(title);
  }
  jobs.push(fillEmbed(box, path, heading, key, opts).catch(() => {}));
  return box;
}

/** #tags (comrak has no tag syntax) become pills that search the workspace. */
function tags(el: HTMLElement) {
  const texts: Text[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n: Node | null; (n = walk.nextNode()); )
    if (n.nodeValue!.includes('#') && !n.parentElement!.closest('code, pre, a, [data-math-style], .front-matter')) texts.push(n as Text);
  for (const node of texts) {
    const s = node.nodeValue!;
    const parts: (string | Node)[] = [];
    let last = 0;
    for (const m of s.matchAll(TAG)) {
      const a = document.createElement('a');
      a.className = 'tag';
      a.href = '#';
      a.dataset.tag = m[1].toLowerCase();
      a.textContent = m[0];
      parts.push(s.slice(last, m.index), a);
      last = m.index! + m[0].length;
    }
    if (parts.length) node.replaceWith(...parts, s.slice(last));
  }
}

async function embeds(el: HTMLElement, opts: RenderOpts) {
  const texts: Text[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n: Node | null; (n = walk.nextNode()); )
    if (n.nodeValue!.includes('![[') && !n.parentElement!.closest('code, pre, a, [data-math-style]')) texts.push(n as Text);
  const jobs: Promise<void>[] = [];
  for (const node of texts) {
    const s = node.nodeValue!;
    const parts: (string | Node)[] = [];
    let last = 0;
    for (const m of s.matchAll(EMBED)) parts.push(s.slice(last, m.index), embedNode(m[1], opts, jobs)), (last = m.index! + m[0].length);
    if (!parts.length) continue;
    parts.push(s.slice(last));
    const p = node.parentElement!;
    node.replaceWith(...parts);
    // a paragraph that is just one note embed becomes the embed (block-level, keeps the line for scroll sync)
    const only = [...p.childNodes].filter((c) => c.nodeType !== 3 || c.nodeValue!.trim());
    if (p.tagName === 'P' && only.length === 1 && (only[0] as Element).classList?.contains('embed')) {
      keepPos(p, only[0] as Element);
      p.replaceWith(only[0]);
    }
  }
  await Promise.all(jobs);
}

const keepPos = (from: Element, to: Element) => {
  const pos = from.getAttribute('data-sourcepos');
  if (pos) to.setAttribute('data-sourcepos', pos);
};

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
    // [[toc]] arrives as a wikilink now that wikilinks are on
    const only = p.childNodes.length === 1 ? (p.firstElementChild as HTMLElement | null) : null;
    const wikiToc = only?.dataset.wikilink && /^toc$/i.test(decodeURIComponent(only.getAttribute('href') ?? ''));
    if (wikiToc || /^\s*\[(\[toc\]|toc)\]\s*$/i.test(p.textContent ?? '')) p.replaceWith(toc(parsed.headings));
  }

  tags(el);
  await embeds(el, opts);

  // math: inline spans and display blocks (```math or $$)
  const maths = el.querySelectorAll<HTMLElement>('[data-math-style], pre[lang="math"]');
  if (maths.length) {
    const katex = await getKatex();
    for (const node of maths) {
      const display = node.dataset.mathStyle === 'display' || node.tagName === 'PRE';
      const holder = document.createElement(display ? 'div' : 'span');
      holder.className = display ? 'math-display' : 'math-inline';
      holder.innerHTML = katex.renderToString(node.textContent ?? '', { displayMode: display, throwOnError: false });
      keepPos(node.closest('pre') ?? node, holder);
      (node.closest('pre') ?? node).replaceWith(holder);
    }
  }

  // mermaid + code highlighting
  const jobs: Promise<void>[] = [];
  const pres = el.querySelectorAll<HTMLElement>('pre');
  const hljs = pres.length ? await getHljs() : null;
  for (const pre of pres) {
    const lang = (pre.getAttribute('lang') ?? '').toLowerCase();
    const code = pre.querySelector('code');
    if (!code) continue;
    if (lang === 'mermaid') {
      const div = document.createElement('div');
      div.className = 'mermaid';
      keepPos(pre, div);
      pre.replaceWith(div);
      const src = code.textContent ?? '';
      const hit = mermaidCache.get((opts.dark ? 'dark' : 'neutral') + '\0' + src);
      if (hit) div.innerHTML = hit;
      else jobs.push(renderMermaid(src, opts.dark).then((svg) => void (div.innerHTML = svg)));
      continue;
    }
    if (hljs && lang && hljs.getLanguage(lang)) {
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

  // relative images -> OPFS blob URLs; ![alt|300](src) sets the width (Obsidian syntax)
  for (const img of el.querySelectorAll('img')) {
    const size = /\|(\d+)(?:x(\d+))?$/.exec(img.alt);
    if (size) (img.alt = img.alt.slice(0, size.index)), (img.width = +size[1]), size[2] && (img.height = +size[2]);
    const src = img.getAttribute('src') ?? '';
    const path = img.dataset.asset ?? resolveRel(opts.docPath, src);
    delete img.dataset.asset;
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

  // [[wikilinks]] and [[note#Heading]]: point at the matching workspace file, or mark as not-yet-created
  for (const a of el.querySelectorAll<HTMLAnchorElement>('a[data-wikilink]')) {
    if (a.dataset.target !== undefined) continue; // inside an embed: already done by its own render
    const target = decodeURIComponent(a.getAttribute('href') ?? '');
    const [note, heading] = splitTarget(target);
    const path = note ? (opts.resolveWiki?.(note, opts.docPath) ?? null) : opts.docPath;
    a.dataset.target = note;
    if (heading) a.dataset.heading = heading;
    if (a.textContent === target) a.textContent = note && heading ? `${note} › ${heading}` : note || heading;
    if (path) a.dataset.path = path;
    else a.classList.add('wikilink-missing');
    const own = !note && parsed.headings.find((h) => headingKey(h.text) === headingKey(heading));
    a.setAttribute('href', own ? `#user-content-${own.id}` : path ? encodeURI(path) : '#');
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
