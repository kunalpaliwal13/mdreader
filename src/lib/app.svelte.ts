import { SvelteSet } from 'svelte/reactivity';
import { flushSync, tick } from 'svelte';
import type { EditorState } from '@codemirror/state';
import { fs, dirname, basename, join, isMarkdown, type Entry, type TrashEntry } from './fs';
import { invalidateAsset, type Heading } from './render';
import welcome from './welcome.md?raw';

export type Mode = 'edit' | 'split' | 'preview';
export type Settings = {
  theme: 'system' | 'light' | 'dark';
  /** base16 scheme id for app chrome + editor (see lib/schemes.ts) */
  scheme: string;
  preset: 'github' | 'academic' | 'minimal' | 'sepia';
  font: 'preset' | 'sans' | 'serif' | 'mono';
  size: number;
  width: number;
  mode: Mode;
  sidebar: boolean;
  sidebarWidth: number;
  /** mode to return to when leaving preview */
  editMode: 'edit' | 'split';
  /** editor share of the split view, in percent */
  split: number;
  /** max width of the editor's text column, px */
  editorWidth: number;
};
export type SidebarView = 'files' | 'search' | 'outline';

const DEFAULTS: Settings = { theme: 'system', scheme: 'default', preset: 'github', font: 'preset', size: 16, width: 760, mode: 'split', sidebar: true, sidebarWidth: 260, editMode: 'split', split: 50, editorWidth: 760 };

/** Animate a DOM-changing state update with the View Transitions API where available. */
export function transition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  doc.startViewTransition(() => {
    update();
    flushSync();
  });
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}
function persist(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

/** Editor states per open file (undo history, selection). Not reactive on purpose. */
export const editorStates = new Map<string, EditorState>();

class App {
  entries = $state<Entry[]>([]);
  trash = $state<TrashEntry[]>([]);
  expanded = new SvelteSet<string>(load<{ v: string[] }>('mdr.expanded', { v: [] }).v);
  selected = new SvelteSet<string>();
  anchor: string | null = null;
  tabs = $state<string[]>([]);
  active = $state<string | null>(null);
  texts = $state<Record<string, string>>({});
  saveState = $state<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  renaming = $state<string | null>(null);
  filter = $state('');
  settings = $state<Settings>(load('mdr.settings', DEFAULTS));
  toast = $state<{ msg: string; kind: 'error' | 'info' } | null>(null);
  cursor = $state({ line: 1, col: 1 });
  sidebarView = $state<SidebarView>('files');
  headings = $state<Heading[]>([]);
  palette = $state<{ open: boolean; query: string }>({ open: false, query: '' });
  /** PWA install prompt captured from beforeinstallprompt (Chromium only). */
  installPrompt = $state<{ prompt: () => void } | null>(null);
  /** Registered by the editor / preview so either side can follow the other, and search/outline can jump. */
  scrollEditorTo: ((line: number) => void) | null = null;
  scrollPreviewTo: ((line: number) => void) | null = null;
  focusEditorLine: ((line: number) => void) | null = null;

  dark = $state(false);
  /** Phone-width layout: no split view (two panes don't fit), sidebar as overlay. */
  narrow = $state(typeof matchMedia !== 'undefined' && matchMedia('(max-width: 760px)').matches);
  /** Set by the mounted editor so external edits (preview checkboxes) keep undo history. */
  editHook: ((path: string, from: number, to: number, insert: string) => boolean) | null = null;
  onRemap: ((map: (p: string) => string) => void) | null = null;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  get mode(): Mode {
    return this.narrow && this.settings.mode === 'split' ? 'preview' : this.settings.mode;
  }

  setMode(m: Mode) {
    if (m === this.mode) return;
    transition(() => {
      this.settings.mode = m;
      this.saveSettings();
    });
  }

  /** The quick Preview / Edit button. */
  togglePreview() {
    if (this.mode === 'preview') return this.setMode(this.narrow ? 'edit' : this.settings.editMode);
    if (!this.narrow) this.settings.editMode = this.mode === 'split' ? 'split' : 'edit';
    this.setMode('preview');
  }

  toggleSplit() {
    const next = this.mode === 'split' ? 'edit' : 'split';
    this.settings.editMode = next;
    this.setMode(next);
  }

  toggleTheme() {
    transition(() => {
      this.settings.theme = this.dark ? 'light' : 'dark';
      this.saveSettings();
    });
  }

  /** Scroll editor + preview to a source line (search hits, outline). */
  revealLine(line: number) {
    if (this.mode !== 'preview') this.focusEditorLine?.(line);
    this.scrollPreviewTo?.(line);
  }

  async openAt(path: string, line?: number) {
    await this.open(path);
    if (!line) return;
    await tick();
    // the preview may still be rendering the newly opened file
    requestAnimationFrame(() => setTimeout(() => this.revealLine(line), 60));
  }

  /** [[target]] -> path: exact path, then same folder, then any file with that name. */
  resolveWiki(target: string, fromDoc: string): string | null {
    const t = target.trim().replace(/\.(md|markdown)$/i, '').toLowerCase();
    if (!t) return null;
    const files = this.entries.filter((e) => e.kind === 'file' && isMarkdown(e.path)).map((e) => e.path);
    const stem = (p: string) => p.replace(/\.(md|markdown|mdx|txt)$/i, '').toLowerCase();
    return (
      files.find((p) => stem(p) === t) ??
      files.find((p) => stem(p) === stem(join(dirname(fromDoc), t))) ??
      files.find((p) => stem(basename(p)) === basename(t)) ??
      null
    );
  }

  /** Every markdown file's text (open buffers win over disk). */
  // ponytail: reads the whole workspace per call; add a cached index if workspaces get into the thousands
  async readAll(): Promise<{ path: string; text: string }[]> {
    const files = this.entries.filter((e) => e.kind === 'file' && isMarkdown(e.path));
    return Promise.all(
      files.map(async (f) => ({ path: f.path, text: f.path in this.texts ? this.texts[f.path] : await fs.read(f.path).catch(() => '') })),
    );
  }

  install() {
    this.installPrompt?.prompt();
    this.installPrompt = null;
  }

  openPalette(query = '') {
    this.palette.query = query;
    this.palette.open = true;
  }

  get activeText() {
    return this.active ? (this.texts[this.active] ?? '') : '';
  }

  saveSettings() {
    persist('mdr.settings', this.settings);
  }
  saveExpanded() {
    persist('mdr.expanded', { v: [...this.expanded] });
  }

  notify(msg: string, kind: 'error' | 'info' = 'info') {
    this.toast = { msg, kind };
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), kind === 'error' ? 6000 : 2500);
  }

  /** Run an fs operation, surface failures as a toast, always refresh the tree. */
  async op<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err) {
      this.notify((err as Error).message, 'error');
    } finally {
      await this.refresh();
    }
  }

  async refresh() {
    this.entries = await fs.list();
  }

  async refreshTrash() {
    this.trash = await fs.listTrash();
  }

  async init() {
    await this.refresh();
    const seeded = load<{ v: boolean }>('mdr.seeded', { v: false }).v;
    if (!this.entries.length && !seeded) {
      await fs.write('Welcome.md', welcome);
      persist('mdr.seeded', { v: true });
      await this.refresh();
    }
    const session = load<{ tabs: string[]; active: string | null }>('mdr.session', { tabs: [], active: null });
    const files = new Set(this.entries.filter((e) => e.kind === 'file').map((e) => e.path));
    for (const t of session.tabs) if (files.has(t)) await this.open(t, false);
    if (session.active && files.has(session.active)) await this.open(session.active);
    else if (!this.tabs.length && files.has('Welcome.md')) await this.open('Welcome.md');
    await this.refreshTrash();
  }

  private saveSession() {
    persist('mdr.session', { tabs: this.tabs, active: this.active });
  }

  async open(path: string, focus = true) {
    if (!isMarkdown(path)) return;
    if (!(path in this.texts)) {
      try {
        this.texts[path] = await fs.read(path);
      } catch (err) {
        return this.notify(`Could not open ${path}: ${(err as Error).message}`, 'error');
      }
    }
    if (!this.tabs.includes(path)) this.tabs.push(path);
    if (focus) {
      if (this.active && this.active !== path) await this.flush(this.active);
      this.active = path;
      // the tree highlights one thing: the open file (multi-select is its own gesture)
      if (this.selected.size <= 1) {
        this.selected.clear();
        this.selected.add(path);
        this.anchor = path;
      }
      // reveal in tree
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) this.expanded.add(parts.slice(0, i).join('/'));
    }
    this.saveSession();
  }

  async close(path: string) {
    await this.flush(path);
    const i = this.tabs.indexOf(path);
    if (i < 0) return;
    this.tabs.splice(i, 1);
    delete this.texts[path];
    editorStates.delete(path);
    if (this.active === path) this.active = this.tabs[Math.min(i, this.tabs.length - 1)] ?? null;
    this.saveSession();
  }

  setText(path: string, text: string) {
    this.texts[path] = text;
    this.saveState = 'unsaved';
    clearTimeout(this.timers.get(path));
    this.timers.set(path, setTimeout(() => this.flush(path), 500));
  }

  edit(path: string, from: number, to: number, insert: string) {
    if (this.editHook?.(path, from, to, insert)) return;
    const t = this.texts[path] ?? '';
    editorStates.delete(path);
    this.setText(path, t.slice(0, from) + insert + t.slice(to));
  }

  async flush(path?: string) {
    const paths = path ? [path] : [...this.timers.keys()];
    for (const p of paths) {
      if (!this.timers.has(p)) continue;
      clearTimeout(this.timers.get(p));
      this.timers.delete(p);
      this.saveState = 'saving';
      try {
        await fs.write(p, this.texts[p] ?? '');
        if (!this.timers.size) this.saveState = 'saved';
      } catch (err) {
        this.saveState = 'error';
        this.notify(`Save failed: ${(err as Error).message}`, 'error');
      }
    }
  }

  /** Keep tabs / buffers / selection pointing at the right place after a move or rename. */
  private remap(from: string, to: string) {
    const map = (p: string) => (p === from ? to : p.startsWith(from + '/') ? to + p.slice(from.length) : p);
    this.onRemap?.(map);
    this.tabs = this.tabs.map(map);
    if (this.active) this.active = map(this.active);
    for (const k of Object.keys(this.texts)) {
      const n = map(k);
      if (n !== k) {
        this.texts[n] = this.texts[k];
        delete this.texts[k];
      }
    }
    for (const [k, s] of [...editorStates]) {
      const n = map(k);
      if (n !== k) {
        editorStates.delete(k);
        editorStates.set(n, s);
      }
    }
    for (const set of [this.expanded, this.selected]) {
      for (const k of [...set]) {
        const n = map(k);
        if (n !== k) {
          set.delete(k);
          set.add(n);
        }
      }
    }
    invalidateAsset(from);
    this.saveSession();
    this.saveExpanded();
  }

  private dropTabsUnder(path: string) {
    for (const t of [...this.tabs]) {
      if (t === path || t.startsWith(path + '/')) {
        clearTimeout(this.timers.get(t));
        this.timers.delete(t);
        const i = this.tabs.indexOf(t);
        this.tabs.splice(i, 1);
        delete this.texts[t];
        editorStates.delete(t);
        if (this.active === t) this.active = this.tabs[Math.min(i, this.tabs.length - 1)] ?? null;
      }
    }
    this.saveSession();
  }

  async createFile(dir = '', name = 'Untitled.md', content = '') {
    const path = await this.op(async () => {
      const p = await fs.uniquePath(join(dir, name));
      await fs.write(p, content);
      return p;
    });
    if (!path) return;
    if (dir) this.expanded.add(dir);
    await this.open(path);
    this.renaming = path;
    return path;
  }

  async createFolder(dir = '') {
    const path = await this.op(async () => {
      const p = await fs.uniquePath(join(dir, 'New folder'));
      await fs.mkdir(p);
      return p;
    });
    if (!path) return;
    if (dir) this.expanded.add(dir);
    this.renaming = path;
  }

  async rename(path: string, name: string) {
    this.renaming = null;
    name = name.trim().replace(/[\\/]/g, '-');
    if (!name || name === basename(path)) return;
    const isFile = this.entries.find((e) => e.path === path)?.kind === 'file';
    if (isFile && isMarkdown(path) && !/\.[^.]+$/.test(name)) name += '.md';
    const to = join(dirname(path), name);
    await this.flushUnder(path);
    const ok = await this.op(async () => (await fs.move(path, to), true));
    if (ok) this.remap(path, to);
  }

  private async flushUnder(path: string) {
    for (const p of [...this.timers.keys()]) if (p === path || p.startsWith(path + '/')) await this.flush(p);
  }

  /** Move paths into destDir. Skips items that would move into themselves. */
  async move(paths: string[], destDir: string) {
    // drop children whose ancestor is also being moved
    const roots = paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(q + '/')));
    for (const p of roots) {
      const to = join(destDir, basename(p));
      if (to === p || destDir === p || destDir.startsWith(p + '/')) continue;
      await this.flushUnder(p);
      const ok = await this.op(async () => (await fs.move(p, to), true));
      if (ok) this.remap(p, to);
    }
    if (destDir) this.expanded.add(destDir);
  }

  async duplicate(path: string) {
    const to = await this.op(async () => {
      await this.flushUnder(path);
      const t = await fs.uniquePath(path);
      await fs.copy(path, t);
      return t;
    });
    if (to && isMarkdown(to)) await this.open(to);
  }

  async remove(paths: string[]) {
    const roots = paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(q + '/')));
    for (const p of roots) {
      this.dropTabsUnder(p);
      await this.op(() => fs.trash(p));
      invalidateAsset(p);
    }
    this.selected.clear();
    await this.refreshTrash();
    this.notify(roots.length === 1 ? `Moved "${basename(roots[0])}" to trash` : `Moved ${roots.length} items to trash`);
  }

  async restore(id: string) {
    const path = await this.op(() => fs.restore(id));
    await this.refreshTrash();
    if (path) this.notify(`Restored "${basename(path)}"`);
  }

  async purge(id: string) {
    await this.op(() => fs.purge(id));
    await this.refreshTrash();
  }

  async emptyTrash() {
    await this.op(() => fs.emptyTrash());
    await this.refreshTrash();
  }

  /** Write imported files (path relative to destDir). Existing names get a numeric suffix. */
  async importFiles(files: { path: string; data: ArrayBuffer | string }[], destDir = '') {
    let firstMd: string | null = null;
    await this.op(async () => {
      for (const f of files) {
        const clean = f.path.split('/').filter((s) => s && !s.startsWith('.') && s !== '__MACOSX').join('/');
        if (!clean) continue;
        const p = await fs.uniquePath(join(destDir, clean));
        await fs.write(p, f.data);
        if (!firstMd && isMarkdown(p)) firstMd = p;
      }
    });
    if (destDir) this.expanded.add(destDir);
    if (firstMd) await this.open(firstMd);
    this.notify(`Imported ${files.length} file${files.length === 1 ? '' : 's'}`);
  }

  /** Save a pasted/dropped image next to the doc; returns the relative link. */
  async saveAsset(docPath: string, file: File): Promise<string | undefined> {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : (file.type.split('/')[1] ?? 'png');
    const base = file.name && file.name !== 'image.png' ? file.name.replace(/\s+/g, '-') : `pasted-${Date.now()}.${ext}`;
    const p = await this.op(async () => {
      const target = await fs.uniquePath(join(join(dirname(docPath), 'assets'), base));
      await fs.write(target, await file.arrayBuffer());
      return target;
    });
    if (!p) return;
    invalidateAsset(p);
    return 'assets/' + encodeURI(basename(p));
  }
}

export const app = new App();
