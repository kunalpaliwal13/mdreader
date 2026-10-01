<script lang="ts">
  // Phone-only bottom bar: the actions people reach for most, in thumb range.
  import {
    FolderTree, TextSearch, ListTree, Ellipsis, Eye, PenLine, Pilcrow, Sun, Moon, FileText, FileCode,
    Printer, Settings, Trash, Command,
  } from '@lucide/svelte';
  import { app } from '../lib/app.svelte';
  import { openMenu, type MenuItem } from '../lib/menu.svelte';
  import { exportMd, exportHtml, exportPdf } from '../lib/transfer';

  const on = (v: typeof app.sidebarView) => app.settings.sidebar && app.sidebarView === v;

  function more(e: MouseEvent) {
    const a = app.active;
    const items: MenuItem[] = [
      ...(a && app.mode !== 'preview'
        ? [{ label: app.settings.plain ? 'Restore smart typing' : 'Plain editor', icon: Pilcrow, action: () => app.togglePlain() }]
        : []),
      { label: app.dark ? 'Light mode' : 'Dark mode', icon: app.dark ? Sun : Moon, action: () => app.toggleTheme() },
      { label: 'Commands…', icon: Command, action: () => app.openPalette('>') },
      ...(a
        ? [
            { sep: true } as const,
            { heading: 'Export' } as const,
            { label: 'Markdown (.md)', icon: FileText, action: () => exportMd(a) },
            { label: 'HTML page', icon: FileCode, action: () => exportHtml(a) },
            { label: 'PDF', icon: Printer, action: () => exportPdf(a) },
          ]
        : []),
      { sep: true },
      { label: 'Appearance', icon: Settings, action: () => (app.panel = 'settings') },
      { label: 'Trash', icon: Trash, action: () => (app.refreshTrash(), (app.panel = 'trash')) },
    ];
    openMenu(e, items, e.currentTarget as HTMLElement);
  }
</script>

<nav class="mbar" aria-label="Main">
  <button class:on={on('files')} onclick={() => app.showSidebarView('files')}><FolderTree size={20} /><span>Files</span></button>
  <button class:on={on('search')} onclick={() => app.showSidebarView('search')}><TextSearch size={20} /><span>Search</span></button>
  {#if app.active}
    <button class="primary" onclick={() => ((app.settings.sidebar = false), app.togglePreview())}>
      {#if app.mode === 'preview'}<PenLine size={20} /><span>Edit</span>{:else}<Eye size={20} /><span>Preview</span>{/if}
    </button>
  {/if}
  <button class:on={on('outline')} onclick={() => app.showSidebarView('outline')}><ListTree size={20} /><span>Outline</span></button>
  <button onclick={more} aria-label="More"><Ellipsis size={20} /><span>More</span></button>
</nav>

<style>
  .mbar {
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    gap: 4px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(12px);
    z-index: 35;
  }
  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 48px;
    max-width: 88px;
    border: 0;
    border-radius: 12px;
    background: none;
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 500;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:active { background: var(--bg-hover); }
  button.on { color: var(--accent); }
  /* the one primary action: same look in both states, the label says what tapping does */
  .primary { color: var(--accent); background: var(--accent-soft); }
</style>
