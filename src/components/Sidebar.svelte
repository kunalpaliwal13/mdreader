<script lang="ts">
  import {
    FilePlus, FolderPlus, Import, Search, Trash, Settings as SettingsIcon, PanelLeftClose, X,
    Pencil, Copy, FileDown, Archive, FileText, FolderUp, FileArchive, FolderTree, TextSearch, ListTree, CalendarDays,
  } from '@lucide/svelte';
  import TreeNode, { type TreeCtx } from './TreeNode.svelte';
  import TrashPanel from './TrashPanel.svelte';
  import SearchView from './SearchView.svelte';
  import OutlineView from './OutlineView.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import { app } from '../lib/app.svelte';
  import { openMenu, type MenuItem } from '../lib/menu.svelte';
  import { buildTree, visibleRows, type TreeNode as Node } from '../lib/tree';
  import { dirname } from '../lib/fs';
  import { importPicker, importDrop, hasFiles, exportZip, exportMd } from '../lib/transfer';

  let dropTarget = $state<string | null>(null);
  let dragging: string[] = [];

  const tree = $derived(buildTree(app.entries, app.filter));
  const filtering = $derived(app.filter.trim().length > 0);
  const isOpen = (p: string) => filtering || app.expanded.has(p);
  const rows = $derived(visibleRows(tree, isOpen));

  /** Folder that new items go into: the selected folder, or the active file's folder. */
  function targetDir(): string {
    const sel = [...app.selected].at(-1);
    const kind = app.entries.find((e) => e.path === sel)?.kind;
    if (sel && kind === 'dir') return sel;
    if (sel) return dirname(sel);
    return app.active ? dirname(app.active) : '';
  }

  const removeMany = (sel: string[]) => (sel.length < 2 || confirm(`Move ${sel.length} items to trash?`)) && app.remove(sel);

  function toggle(path: string) {
    if (app.expanded.has(path)) app.expanded.delete(path);
    else app.expanded.add(path);
    app.saveExpanded();
  }

  function click(e: MouseEvent, n: Node) {
    const multi = e.metaKey || e.ctrlKey;
    if (e.shiftKey && app.anchor) {
      const a = rows.findIndex((r) => r.path === app.anchor);
      const b = rows.findIndex((r) => r.path === n.path);
      if (a >= 0 && b >= 0) {
        app.selected.clear();
        for (const r of rows.slice(Math.min(a, b), Math.max(a, b) + 1)) app.selected.add(r.path);
        return;
      }
    }
    if (multi) {
      if (app.selected.has(n.path)) app.selected.delete(n.path);
      else app.selected.add(n.path);
      app.anchor = n.path;
      return;
    }
    app.selected.clear();
    app.selected.add(n.path);
    app.anchor = n.path;
    if (n.kind === 'dir') toggle(n.path);
    else {
      app.open(n.path);
      if (matchMedia('(max-width: 760px)').matches) app.settings.sidebar = false;
    }
  }

  function menu(e: MouseEvent, n: Node, anchor?: HTMLElement) {
    // right-clicking outside the selection targets just that row
    if (!app.selected.has(n.path)) {
      app.selected.clear();
      app.selected.add(n.path);
      app.anchor = n.path;
    }
    const sel = [...app.selected];
    if (sel.length > 1) {
      return openMenu(e, [
        { heading: `${sel.length} items` },
        { label: 'Move to trash', icon: Trash, danger: true, action: () => removeMany(sel), kbd: '⌫' },
      ], anchor);
    }
    const dir = n.kind === 'dir' ? n.path : dirname(n.path);
    const items: MenuItem[] = [
      { label: 'New file', icon: FilePlus, action: () => app.createFile(dir) },
      { label: 'New folder', icon: FolderPlus, action: () => app.createFolder(dir) },
      { sep: true },
      { label: 'Rename', icon: Pencil, action: () => (app.renaming = n.path), kbd: 'F2' },
      { label: 'Duplicate', icon: Copy, action: () => app.duplicate(n.path) },
      n.kind === 'dir'
        ? { label: 'Export as ZIP', icon: Archive, action: () => exportZip(n.path) }
        : { label: 'Download', icon: FileDown, action: () => exportMd(n.path) },
      { sep: true },
      { label: 'Move to trash', icon: Trash, danger: true, action: () => app.remove([n.path]), kbd: '⌫' },
    ];
    openMenu(e, items, anchor);
  }

  function importMenu(e: MouseEvent) {
    const dir = targetDir();
    openMenu(e, [
      { heading: dir ? `Import into ${dir}` : 'Import into workspace' },
      { label: 'Markdown files…', icon: FileText, action: () => importPicker('files', dir) },
      { label: 'Folder…', icon: FolderUp, action: () => importPicker('folder', dir) },
      { label: 'ZIP archive…', icon: FileArchive, action: () => importPicker('zip', dir) },
      { sep: true },
      { label: 'Export workspace as ZIP', icon: Archive, action: () => exportZip('') },
    ], e.currentTarget as HTMLElement);
  }

  function dragStart(e: DragEvent, n: Node) {
    dragging = app.selected.has(n.path) ? [...app.selected] : [n.path];
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('application/x-mdr', dragging.join('\n'));
    e.dataTransfer!.setData('text/plain', n.path);
  }

  function dragOver(e: DragEvent, dir: string) {
    const internal = e.dataTransfer?.types.includes('application/x-mdr');
    if (!internal && !hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = internal ? 'move' : 'copy';
    dropTarget = dir;
  }

  async function drop(e: DragEvent, dir: string) {
    e.preventDefault();
    e.stopPropagation();
    dropTarget = null;
    const internal = e.dataTransfer?.getData('application/x-mdr');
    if (internal) {
      await app.move(internal.split('\n'), dir);
      dragging = [];
    } else if (e.dataTransfer) await importDrop(e.dataTransfer, dir);
  }

  const ctx: TreeCtx = { isOpen, click, menu, dragStart, dragOver, drop, dropTarget: () => dropTarget };

  function treeKey(e: KeyboardEvent) {
    if (app.renaming || (e.target as HTMLElement).tagName === 'INPUT') return;
    const sel = [...app.selected];
    const cur = rows.findIndex((r) => r.path === (app.anchor ?? sel.at(-1)));
    const pick = (i: number) => {
      const r = rows[Math.max(0, Math.min(rows.length - 1, i))];
      if (!r) return;
      app.selected.clear();
      app.selected.add(r.path);
      app.anchor = r.path;
      document.querySelector(`.row[data-path="${CSS.escape(r.path)}"]`)?.scrollIntoView({ block: 'nearest' });
    };
    const node = rows[cur];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      return pick(cur < 0 ? 0 : cur + (e.key === 'ArrowDown' ? 1 : -1));
    }
    if (e.key === 'ArrowRight' && node?.kind === 'dir') {
      e.preventDefault();
      if (!isOpen(node.path)) toggle(node.path);
      else pick(cur + 1);
      return;
    }
    if (e.key === 'ArrowLeft' && node) {
      e.preventDefault();
      if (node.kind === 'dir' && isOpen(node.path)) toggle(node.path);
      else pick(rows.findIndex((r) => r.path === dirname(node.path)));
      return;
    }
    if (e.key === 'Enter' && node) {
      e.preventDefault();
      if (node.kind === 'dir') toggle(node.path);
      else app.open(node.path);
      return;
    }
    if (e.key === 'F2' && sel.length === 1) {
      e.preventDefault();
      app.renaming = sel[0];
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) {
      e.preventDefault();
      removeMany(sel);
    } else if (e.key === 'Escape') app.selected.clear();
  }
</script>

<aside class="sidebar">
  <header>
    <span class="brand">mdreader</span>
    <div class="actions">
      <button class="icon-btn" title="New file" aria-label="New file" onclick={() => app.createFile(targetDir())}><FilePlus size={15} /></button>
      <button class="icon-btn" title="New folder" aria-label="New folder" onclick={() => app.createFolder(targetDir())}><FolderPlus size={15} /></button>
      <button class="icon-btn" title="Today's note" aria-label="Today's note" onclick={() => app.openDaily()}><CalendarDays size={15} /></button>
      <button class="icon-btn" title="Import / export" aria-label="Import" onclick={importMenu}><Import size={15} /></button>
      <button class="icon-btn" title="Hide sidebar (⌘\)" aria-label="Hide sidebar" onclick={() => ((app.settings.sidebar = false), app.saveSettings())}><PanelLeftClose size={15} /></button>
    </div>
  </header>

  <div class="views" role="tablist" aria-label="Sidebar view">
    {#each [['files', 'Files', FolderTree], ['search', 'Search', TextSearch], ['outline', 'Outline', ListTree]] as const as [id, label, Icon] (id)}
      <button
        role="tab"
        aria-selected={app.sidebarView === id}
        class:on={app.sidebarView === id}
        title={label + (id === 'search' ? ' (⌘⇧F)' : '')}
        onclick={() => (app.sidebarView = id)}
      ><Icon size={14} /><span>{label}</span></button>
    {/each}
  </div>

  {#if app.sidebarView === 'search'}
    <SearchView />
  {:else if app.sidebarView === 'outline'}
    <OutlineView />
  {:else}
  <label class="filter">
    <Search size={13} />
    <input placeholder="Filter files" bind:value={app.filter} onkeydown={(e) => e.key === 'Escape' && (app.filter = '')} />
    {#if app.filter}<button class="icon-btn clear" aria-label="Clear filter" onclick={() => (app.filter = '')}><X size={12} /></button>{/if}
  </label>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="tree"
    class:drop={dropTarget === ''}
    role="tree"
    tabindex="0"
    onkeydown={treeKey}
    ondragover={(e) => dragOver(e, '')}
    ondragleave={(e) => { if (e.currentTarget === e.target) dropTarget = null; }}
    ondrop={(e) => drop(e, '')}
    onclick={(e) => { if (e.target === e.currentTarget) app.selected.clear(); }}
    oncontextmenu={(e) => {
      if (e.target !== e.currentTarget) return;
      openMenu(e, [
        { label: 'New file', icon: FilePlus, action: () => app.createFile('') },
        { label: 'New folder', icon: FolderPlus, action: () => app.createFolder('') },
      ]);
    }}
  >
    {#each tree as node (node.path)}
      <TreeNode {node} depth={0} {ctx} />
    {:else}
      <div class="empty">
        {#if filtering}No files match “{app.filter}”{:else}No files yet.<br />Create one or drop files here.{/if}
      </div>
    {/each}
  </div>
  {/if}

  <footer>
    <button class="foot-btn" class:active={app.panel === 'trash'} onclick={() => { app.panel = app.panel === 'trash' ? null : 'trash'; app.refreshTrash(); }}>
      <Trash size={14} /> Trash {#if app.trash.length}<span class="count">{app.trash.length}</span>{/if}
    </button>
    <button class="icon-btn" class:active={app.panel === 'settings'} title="Settings" aria-label="Settings" onclick={() => (app.panel = app.panel === 'settings' ? null : 'settings')}>
      <SettingsIcon size={15} />
    </button>
  </footer>

  {#if !app.narrow}
    {#if app.panel === 'trash'}<TrashPanel onclose={() => (app.panel = null)} />{/if}
    {#if app.panel === 'settings'}<SettingsPanel onclose={() => (app.panel = null)} />{/if}
  {/if}
</aside>

<style>
  .sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--bg-subtle);
    border-right: 1px solid var(--border);
    min-width: 0;
  }
  .views { display: flex; gap: 2px; margin: 0 8px 8px; padding: 2px; border-radius: 7px; background: var(--bg-hover); }
  .views button {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 24px; border: 0;
    border-radius: 5px; background: none; color: var(--text-muted); font-size: 12px; cursor: pointer;
  }
  .views button:hover { color: var(--text); }
  .views button.on { background: var(--bg-elevated); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
  header { display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 8px 0 14px; }
  .brand { font-weight: 600; letter-spacing: -0.01em; font-size: 13px; }
  .actions { display: flex; gap: 1px; }
  .filter {
    display: flex; align-items: center; gap: 6px; margin: 0 8px 6px; padding: 0 6px 0 8px; height: 28px;
    border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); color: var(--text-faint);
  }
  .filter:focus-within { border-color: var(--border-strong); }
  .filter input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 12.5px; }
  .filter input::placeholder { color: var(--text-faint); }
  .clear { width: 18px; height: 18px; }
  .tree { flex: 1; overflow-y: auto; padding: 2px 0 12px; outline: none; }
  .tree.drop { background: var(--accent-soft); }
  .empty { padding: 24px 16px; color: var(--text-faint); text-align: center; font-size: 12px; line-height: 1.6; }
  footer { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-top: 1px solid var(--border); }
  .foot-btn {
    display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; border: 0; border-radius: var(--radius);
    background: none; color: var(--text-muted); cursor: pointer;
  }
  .foot-btn:hover, .foot-btn.active { background: var(--bg-hover); color: var(--text); }
  .count { font-size: 11px; padding: 0 5px; border-radius: 8px; background: var(--bg-active); color: var(--text-muted); }
  @media (max-width: 760px) {
    footer { display: none; } /* Trash + Appearance live in the bottom bar's More sheet */
    header { height: 52px; }
    .views button { height: 32px; font-size: 13px; }
    .filter { height: 38px; }
  }
</style>
