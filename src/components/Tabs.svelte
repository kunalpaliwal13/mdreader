<script lang="ts">
  import { X, PanelLeft, PenLine, Columns2, Eye, Download, FileText, FileCode, Printer } from '@lucide/svelte';
  import { app, type Mode } from '../lib/app.svelte';
  import { openMenu } from '../lib/menu.svelte';
  import { basename, dirname } from '../lib/fs';
  import { exportMd, exportHtml, exportPdf } from '../lib/transfer';

  // show the folder next to tabs whose file names collide
  const dupes = $derived.by(() => {
    const seen = new Map<string, number>();
    for (const t of app.tabs) seen.set(basename(t), (seen.get(basename(t)) ?? 0) + 1);
    return seen;
  });

  const modes: { id: Mode; label: string; icon: typeof PenLine }[] = [
    { id: 'edit', label: 'Edit', icon: PenLine },
    { id: 'split', label: 'Split', icon: Columns2 },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

  function setMode(m: Mode) {
    app.settings.mode = m;
    app.saveSettings();
  }

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

  {#if app.active}
    <div class="right">
      <div class="seg" role="radiogroup" aria-label="View mode">
        {#each modes as m (m.id)}
          <button
            class:on={app.settings.mode === m.id}
            role="radio"
            aria-checked={app.settings.mode === m.id}
            title="{m.label} (⌘E cycles)"
            aria-label={m.label}
            onclick={() => setMode(m.id)}
          ><m.icon size={14} /></button>
        {/each}
      </div>
      <button class="icon-btn" title="Export" aria-label="Export" onclick={exportMenu}><Download size={15} /></button>
    </div>
  {/if}
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
  .seg { display: flex; padding: 2px; gap: 2px; border-radius: 7px; background: var(--bg-hover); }
  .seg button {
    display: grid; place-items: center; width: 28px; height: 22px; padding: 0; border: 0; border-radius: 5px;
    background: none; color: var(--text-muted); cursor: pointer;
  }
  .seg button:hover { color: var(--text); }
  .seg button.on { background: var(--bg-elevated); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / .1); }
</style>
