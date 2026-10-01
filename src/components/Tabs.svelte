<script lang="ts">
  import { X, PanelLeft, PenLine, Columns2, Eye, Download, FileText, FileCode, Printer, Sun, Moon, Pilcrow } from '@lucide/svelte';
  import { app } from '../lib/app.svelte';
  import { openMenu } from '../lib/menu.svelte';
  import { basename, dirname } from '../lib/fs';
  import { exportMd, exportHtml, exportPdf } from '../lib/transfer';

  // show the folder next to tabs whose file names collide
  const dupes = $derived.by(() => {
    const seen = new Map<string, number>();
    for (const t of app.tabs) seen.set(basename(t), (seen.get(basename(t)) ?? 0) + 1);
    return seen;
  });

  function exportMenu(e: MouseEvent) {
    const p = app.active;
    if (!p) return;
    openMenu(e, [
      { heading: 'Export' },
      { label: 'Markdown (.md)', icon: FileText, action: () => exportMd(p) },
      { label: 'HTML page (.html)', icon: FileCode, action: () => exportHtml(p) },
      { label: 'PDF…', icon: Printer, action: () => exportPdf(p) },
    ], e.currentTarget as HTMLElement);
  }

  function wheel(e: WheelEvent) {
    // vertical wheel scrolls the tab strip sideways
    const el = e.currentTarget as HTMLElement;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
  }
</script>

<div class="bar">
  {#if !app.settings.sidebar}
    <button class="icon-btn side" title="Show sidebar (⌘\)" aria-label="Show sidebar" onclick={() => ((app.settings.sidebar = true), app.saveSettings())}>
      <PanelLeft size={15} />
    </button>
  {/if}

  <div class="tabs" role="tablist" onwheel={wheel}>
    {#each app.tabs as t (t)}
      <div
        class="tab"
        class:active={app.active === t}
        role="tab"
        tabindex="0"
        aria-selected={app.active === t}
        title={t}
        onclick={() => app.open(t)}
        onkeydown={(e) => e.key === 'Enter' && app.open(t)}
        onauxclick={(e) => e.button === 1 && app.close(t)}
      >
        <span class="name">{basename(t).replace(/\.md$/i, '')}</span>
        {#if (dupes.get(basename(t)) ?? 0) > 1 && dirname(t)}<span class="dir">{dirname(t)}</span>{/if}
        <button class="close" aria-label="Close tab" onclick={(e) => (e.stopPropagation(), app.close(t))}><X size={12} /></button>
      </div>
    {/each}
  </div>

  <div class="right">
    {#if app.active}
      {#if !app.narrow}
        <button
          class="icon-btn"
          class:active={app.mode === 'split'}
          aria-pressed={app.mode === 'split'}
          title="Split view"
          aria-label="Split view"
          onclick={() => app.toggleSplit()}
        ><Columns2 size={15} /></button>
      {/if}
      <button
        class="pill"
        class:on={app.mode === 'preview'}
        aria-pressed={app.mode === 'preview'}
        title={app.mode === 'preview' ? 'Back to editing (⌘E)' : 'Preview (⌘E)'}
        onclick={() => app.togglePreview()}
      >
        {#if app.mode === 'preview'}<PenLine size={14} /><span>Edit</span>{:else}<Eye size={14} /><span>Preview</span>{/if}
      </button>
      {#if app.mode !== 'preview'}
        <button
          class="icon-btn"
          class:active={app.settings.plain}
          aria-pressed={app.settings.plain}
          title={app.settings.plain ? 'Plain editor on — click to restore smart typing (⌘⇧E)' : 'Plain editor: pause smart typing (⌘⇧E)'}
          aria-label="Plain editor"
          onclick={() => app.togglePlain()}
        ><Pilcrow size={15} /></button>
      {/if}
    {/if}
    <button
      class="icon-btn"
      title={app.dark ? 'Light mode' : 'Dark mode'}
      aria-label={app.dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onclick={() => app.toggleTheme()}
    >{#if app.dark}<Sun size={15} />{:else}<Moon size={15} />{/if}</button>
    {#if app.active}
      <span class="sep"></span>
      <button class="icon-btn" title="Export" aria-label="Export" onclick={exportMenu}><Download size={15} /></button>
    {/if}
  </div>
</div>

<style>
  .bar {
    display: flex;
    align-items: stretch;
    height: 40px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    min-width: 0;
  }
  .side { align-self: center; margin: 0 2px 0 8px; }
  .tabs { flex: 1; display: flex; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .tabs::-webkit-scrollbar { display: none; }
  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
    padding: 0 6px 0 14px;
    border-right: 1px solid var(--border);
    color: var(--text-muted);
    cursor: default;
    white-space: nowrap;
    flex: none;
  }
  .tab:hover { color: var(--text); background: var(--bg-subtle); }
  .tab.active { color: var(--text); background: var(--bg); }
  .tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: var(--bg); }
  .tab.active::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: var(--accent); }
  .tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .name { overflow: hidden; text-overflow: ellipsis; }
  .dir { font-size: 11px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; }
  .close {
    display: grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 4px;
    background: none; color: var(--text-faint); cursor: pointer; opacity: 0;
  }
  .tab:hover .close, .tab.active .close { opacity: 1; }
  .close:hover { background: var(--bg-active); color: var(--text); }
  .right { display: flex; align-items: center; gap: 6px; padding: 0 10px; flex: none; }
  .pill {
    display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px 0 10px; margin: 0 2px;
    border: 1px solid var(--border-strong); border-radius: 14px; background: var(--bg-elevated); color: var(--text);
    font-weight: 500; font-size: 12.5px; cursor: pointer; transition: background .12s, border-color .12s, color .12s;
  }
  .pill:hover { background: var(--bg-hover); }
  .pill.on { background: var(--text); border-color: var(--text); color: var(--bg); }
  .pill:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .sep { width: 1px; height: 18px; margin: 0 4px; background: var(--border); }
  @media (max-width: 760px) {
    .tab { max-width: 150px; padding-left: 10px; }
    .dir { display: none; }
    .right { padding: 0 6px; gap: 2px; }
    .pill span { display: none; }
    .pill { padding: 0 9px; }
  }
</style>
