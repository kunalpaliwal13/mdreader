<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Tabs from './components/Tabs.svelte';
  import Editor from './components/Editor.svelte';
  import Preview from './components/Preview.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import Menu from './components/Menu.svelte';
  import Palette from './components/Palette.svelte';
  import MobileBar from './components/MobileBar.svelte';
  import TrashPanel from './components/TrashPanel.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import { app } from './lib/app.svelte';
  import { importDrop, hasFiles } from './lib/transfer';

  let ready = $state(false);
  let fileDrag = $state(false);
  let dragDepth = 0;

  // theme: explicit setting or follow the OS
  const media = matchMedia('(prefers-color-scheme: dark)');
  let systemDark = $state(media.matches);
  media.addEventListener('change', (e) => (systemDark = e.matches));
  $effect(() => {
    app.dark = app.settings.theme === 'dark' || (app.settings.theme === 'system' && systemDark);
    document.documentElement.dataset.theme = app.dark ? 'dark' : 'light';
    document.documentElement.dataset.scheme = app.settings.scheme;
  });

  $effect(() => {
    document.title = app.active ? `${app.active.split('/').pop()} · mdreader` : 'mdreader';
  });

  const narrowMq = matchMedia('(max-width: 760px)');
  narrowMq.addEventListener('change', (e) => (app.narrow = e.matches));

  onMount(async () => {
    // phones and portrait tablets start with the document, not the tree
    if (matchMedia('(max-width: 1024px)').matches) app.settings.sidebar = false;
    try {
      await app.init();
    } catch (err) {
      app.notify(`Browser storage is unavailable (private window?). Files cannot be saved. ${(err as Error).message}`, 'error');
    }
    ready = true;
  });

  function onKey(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'p') {
      // ⌘P files, ⌘⇧P commands (browser print stays reachable via Export → PDF)
      e.preventDefault();
      if (app.palette.open && !e.shiftKey === !app.palette.query.startsWith('>')) app.palette.open = false;
      else app.openPalette(e.shiftKey ? '>' : '');
      return;
    }
    if (k === 'f' && e.shiftKey) {
      e.preventDefault();
      app.settings.sidebar = true;
      app.sidebarView = 'search';
      return;
    }
    if (e.key === '\\') {
      e.preventDefault();
      app.settings.sidebar = !app.settings.sidebar;
      app.saveSettings();
    } else if (e.key.toLowerCase() === 's' && !e.shiftKey) {
      e.preventDefault();
      app.flush().then(() => app.active && app.notify('Saved'));
    } else if (k === 'e' && e.shiftKey && app.active) {
      e.preventDefault();
      app.togglePlain();
    } else if (e.key.toLowerCase() === 'e' && !e.shiftKey && app.active) {
      e.preventDefault();
      app.togglePreview();
    }
  }

  // editor / preview split resize
  let contentEl = $state<HTMLElement>();
  function startSplit(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = contentEl!.getBoundingClientRect();
      app.settings.split = Math.round(Math.min(80, Math.max(20, ((ev.clientX - r.left) / r.width) * 100)));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      app.saveSettings();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }

  // sidebar resize
  function startResize(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => (app.settings.sidebarWidth = Math.round(Math.min(480, Math.max(200, ev.clientX))));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      app.saveSettings();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }

  // files dropped anywhere else import into the workspace root
  const windowDrag = {
    dragenter: (e: DragEvent) => hasFiles(e) && (dragDepth++, (fileDrag = true)),
    dragleave: (e: DragEvent) => hasFiles(e) && --dragDepth <= 0 && ((dragDepth = 0), (fileDrag = false)),
    dragover: (e: DragEvent) => hasFiles(e) && e.preventDefault(),
    drop: (e: DragEvent) => {
      dragDepth = 0;
      fileDrag = false;
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) importDrop(e.dataTransfer, '');
    },
  };
</script>

<svelte:window
  onkeydown={onKey}
  ondragenter={windowDrag.dragenter}
  ondragleave={windowDrag.dragleave}
  ondragover={windowDrag.dragover}
  ondrop={windowDrag.drop}
  onbeforeunload={() => app.flush()}
  onbeforeinstallprompt={(e) => (e.preventDefault(), (app.installPrompt = e as unknown as { prompt: () => void }))}
/>
<svelte:document onvisibilitychange={() => document.visibilityState === 'hidden' && app.flush()} />

<div class="app" class:no-side={!app.settings.sidebar} style="--side-w:{app.settings.sidebarWidth}px">
  {#if app.settings.sidebar}
    <div class="side">
      <Sidebar />
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="resize" onpointerdown={startResize}></div>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="scrim" onclick={() => (app.settings.sidebar = false)}></div>
  {/if}

  <main>
    <Tabs />
    <div class="content mode-{app.mode}" style="--split:{app.settings.split}%" bind:this={contentEl}>
      {#if app.active}
        <div class="pane editor-pane"><Editor path={app.active} /></div>
        {#if app.mode === 'split'}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="divider" title="Drag to resize · double-click to reset" onpointerdown={startSplit} ondblclick={() => ((app.settings.split = 50), app.saveSettings())}></div>
        {/if}
        <div class="pane preview-pane"><Preview path={app.active} text={app.activeText} /></div>
      {:else if ready}
        <EmptyState />
      {/if}
    </div>
    {#if app.narrow}<MobileBar />{:else}<StatusBar />{/if}
  </main>
</div>

{#if fileDrag}<div class="drop-hint">Drop to import</div>{/if}

{#if app.toast}
  <div class="toast {app.toast.kind}" role="status">{app.toast.msg}</div>
{/if}

{#if app.narrow}
  {#if app.panel === 'trash'}<TrashPanel onclose={() => (app.panel = null)} />{/if}
  {#if app.panel === 'settings'}<SettingsPanel onclose={() => (app.panel = null)} />{/if}
{/if}

<Menu />
<Palette />

<style>
  .app {
    display: grid;
    height: 100dvh;
    grid-template-columns: var(--side-w) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    height: 100%;
  }
  .app.no-side { grid-template-columns: minmax(0, 1fr); }
  .side { position: relative; min-width: 0; height: 100%; }
  .resize { position: absolute; top: 0; right: -3px; width: 6px; height: 100%; cursor: col-resize; z-index: 5; }
  .resize:hover { background: linear-gradient(to right, transparent 2px, var(--accent) 2px, var(--accent) 3px, transparent 3px); }
  .scrim { display: none; }
  main { display: flex; flex-direction: column; min-width: 0; height: 100%; }
  .content {
    position: relative; flex: 1; min-height: 0; display: grid;
    grid-template-columns: minmax(0, var(--split, 50%)) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr);
    view-transition-name: workspace;
  }
  .divider { position: absolute; top: 0; bottom: 0; left: calc(var(--split) - 3px); width: 6px; cursor: col-resize; z-index: 5; }
  .divider:hover, .divider:active { background: linear-gradient(to right, transparent 2px, var(--accent) 2px, var(--accent) 4px, transparent 4px); }
  .pane { min-width: 0; min-height: 0; overflow: hidden; }
  .content.mode-split .editor-pane { border-right: 1px solid var(--border); }
  .content.mode-edit { grid-template-columns: minmax(0, 1fr); }
  .content.mode-edit .preview-pane { display: none; }
  .content.mode-preview { grid-template-columns: minmax(0, 1fr); }
  .content.mode-preview .editor-pane { display: none; }
  .content:has(> :global(.empty)) { grid-template-columns: minmax(0, 1fr); }

  .drop-hint {
    position: fixed; inset: 8px; z-index: 60; pointer-events: none; display: grid; place-items: end center; padding-bottom: 40px;
    border: 2px dashed var(--accent); border-radius: 12px; background: var(--accent-soft); color: var(--accent); font-weight: 600;
  }
  .toast {
    position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%); z-index: 70; max-width: min(520px, calc(100vw - 32px));
    padding: 8px 14px; border-radius: 8px; background: var(--text); color: var(--bg); box-shadow: var(--shadow);
    font-size: 12.5px; animation: pop .15s ease-out;
  }
  .toast.error { background: var(--danger); color: #fff; }

  /* browser print (⌘P) prints just the document */
  @media print {
    :global(html), :global(body), :global(#app) { height: auto !important; overflow: visible !important; }
    .app { display: block; }
    .side, .scrim, .editor-pane, .toast, .drop-hint, main > :global(.bar), main > :global(.status) { display: none !important; }
    main, .content, .pane { display: block !important; height: auto !important; overflow: visible !important; }
    .preview-pane :global(.scroller) { height: auto; overflow: visible; }
  }

  @media (max-width: 760px) {
    .app, .app.no-side { grid-template-columns: minmax(0, 1fr); }
    /* drawer stops above the bottom bar so Files / Search / Outline stay switchable */
    .side { position: fixed; inset: 0 auto calc(61px + env(safe-area-inset-bottom)) 0; height: auto; width: min(320px, 86vw); z-index: 30; box-shadow: var(--shadow); }
    .resize { display: none; }
    .scrim { display: block; position: fixed; inset: 0 0 calc(61px + env(safe-area-inset-bottom)) 0; z-index: 29; background: rgb(0 0 0 / .3); }
  }
</style>
