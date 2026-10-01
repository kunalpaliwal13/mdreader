<script lang="ts">
  import { tick } from 'svelte';
  import { FileText, Command, CornerDownLeft } from '@lucide/svelte';
  import { app } from '../lib/app.svelte';
  import { basename, dirname, isMarkdown } from '../lib/fs';
  import { exportMd, exportHtml, exportPdf, exportZip, importPicker } from '../lib/transfer';

  type Item = { id: string; label: string; detail?: string; kbd?: string; run: () => void; score: number; marks: number[] };

  let input = $state<HTMLInputElement>();
  let index = $state(0);
  let list = $state<HTMLElement>();
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

  /** Subsequence fuzzy match: consecutive runs and word starts score higher. null = no match. */
  function fuzzy(q: string, text: string): { score: number; marks: number[] } | null {
    if (!q) return { score: 0, marks: [] };
    const t = text.toLowerCase();
    const marks: number[] = [];
    let score = 0, ti = 0, prev = -2;
    for (const ch of q.toLowerCase()) {
      if (ch === ' ') continue;
      const at = t.indexOf(ch, ti);
      if (at < 0) return null;
      score += at === prev + 1 ? 5 : 1;
      if (at === 0 || /[\s/_.-]/.test(t[at - 1])) score += 3;
      marks.push(at);
      prev = at;
      ti = at + 1;
    }
    return { score: score - t.length * 0.01, marks };
  }

  const commands = $derived.by(() => {
    const a = app.active;
    const cmds: Omit<Item, 'score' | 'marks'>[] = [
      { id: 'new-file', label: 'New file', run: () => app.createFile(a ? dirname(a) : '') },
      { id: 'new-folder', label: 'New folder', run: () => app.createFolder(a ? dirname(a) : '') },
      { id: 'preview', label: app.mode === 'preview' ? 'Back to editing' : 'Toggle preview', kbd: `${mod}E`, run: () => app.togglePreview() },
      ...(!app.narrow ? [{ id: 'split', label: 'Toggle split view', run: () => app.toggleSplit() }] : []),
      { id: 'plain', label: app.settings.plain ? 'Restore smart typing' : 'Plain editor (pause smart typing)', kbd: `${mod}⇧E`, run: () => app.togglePlain() },
      { id: 'theme', label: app.dark ? 'Switch to light mode' : 'Switch to dark mode', run: () => app.toggleTheme() },
      { id: 'sidebar', label: 'Toggle sidebar', kbd: `${mod}\\`, run: () => ((app.settings.sidebar = !app.settings.sidebar), app.saveSettings()) },
      { id: 'search', label: 'Search in files', kbd: `${mod}⇧F`, run: () => showView('search') },
      { id: 'outline', label: 'Show outline & backlinks', run: () => showView('outline') },
      { id: 'files', label: 'Show files', run: () => showView('files') },
      ...(a
        ? [
            { id: 'export-md', label: 'Export as Markdown', run: () => exportMd(a) },
            { id: 'export-html', label: 'Export as HTML', run: () => exportHtml(a) },
            { id: 'export-pdf', label: 'Export as PDF', run: () => exportPdf(a) },
            { id: 'rename', label: 'Rename current file', run: () => (showView('files'), (app.renaming = a)) },
            { id: 'close', label: 'Close tab', run: () => app.close(a) },
            { id: 'delete', label: 'Move current file to trash', run: () => app.remove([a]) },
          ]
        : []),
      { id: 'export-zip', label: 'Export workspace as ZIP', run: () => exportZip('') },
      { id: 'import-files', label: 'Import markdown files…', run: () => importPicker('files') },
      { id: 'import-folder', label: 'Import folder…', run: () => importPicker('folder') },
      { id: 'import-zip', label: 'Import ZIP…', run: () => importPicker('zip') },
      ...(app.installPrompt ? [{ id: 'install', label: 'Install mdreader as an app', run: () => app.install() }] : []),
    ];
    return cmds;
  });

  function showView(v: typeof app.sidebarView) {
    app.sidebarView = v;
    app.settings.sidebar = true;
  }

  const isCommand = $derived(app.palette.query.startsWith('>'));
  const q = $derived((isCommand ? app.palette.query.slice(1) : app.palette.query).trim());

  const items = $derived.by((): Item[] => {
    const source = isCommand
      ? commands.map((c) => ({ ...c, match: c.label }))
      : app.entries
          .filter((e) => e.kind === 'file' && isMarkdown(e.path))
          .map((e) => ({ id: e.path, label: basename(e.path), detail: dirname(e.path), run: () => app.open(e.path), match: e.path }));
    const out: Item[] = [];
    for (const s of source) {
      // files: match the name first, fall back to the whole path
      const m = fuzzy(q, s.label) ?? (s.match !== s.label ? fuzzy(q, s.match) : null);
      if (m) out.push({ ...s, score: m.score + (fuzzy(q, s.label) ? 10 : 0), marks: fuzzy(q, s.label)?.marks ?? [] });
    }
    // recent tabs float to the top of the empty file list
    if (!q && !isCommand) out.sort((x, y) => (app.tabs.includes(y.id) ? 1 : 0) - (app.tabs.includes(x.id) ? 1 : 0));
    else if (q) out.sort((x, y) => y.score - x.score);
    return out.slice(0, 60);
  });

  $effect(() => {
    void items;
    index = 0;
  });

  $effect(() => {
    if (app.palette.open) tick().then(() => input?.focus());
  });

  function close() {
    app.palette.open = false;
  }

  function choose(i: number) {
    const it = items[i];
    if (!it) return;
    close();
    it.run();
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') return (e.preventDefault(), close());
    if (e.key === 'Enter') return (e.preventDefault(), choose(index));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      index = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
      tick().then(() => list?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }));
    }
  }

  const highlight = (label: string, marks: number[]) =>
    [...label].map((ch, i) => ({ ch, on: marks.includes(i) }));
</script>

{#if app.palette.open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="scrim" onclick={close}></div>
  <div class="palette" role="dialog" aria-label="Command palette">
    <div class="head">
      {#if isCommand}<Command size={15} />{:else}<FileText size={15} />{/if}
      <input
        bind:this={input}
        bind:value={app.palette.query}
        onkeydown={key}
        placeholder={isCommand ? 'Run a command…' : 'Go to file…   (type > for commands)'}
        aria-label="Palette query"
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
      />
    </div>
    <div class="list" id="palette-list" role="listbox" bind:this={list}>
      {#each items as it, i (it.id)}
        <button class="item" class:on={i === index} role="option" aria-selected={i === index} onpointermove={() => (index = i)} onclick={() => choose(i)}>
          <span class="label">{#each highlight(it.label, it.marks) as c}{#if c.on}<b>{c.ch}</b>{:else}{c.ch}{/if}{/each}</span>
          {#if it.detail}<span class="detail">{it.detail}</span>{/if}
          {#if it.kbd}<span class="kbd">{it.kbd}</span>{/if}
          {#if i === index}<CornerDownLeft size={12} />{/if}
        </button>
      {:else}
        <div class="none">{isCommand ? 'No matching command' : 'No matching file'}</div>
      {/each}
    </div>
    <div class="foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span>
      <span class="spacer"></span>
      {#if !isCommand}<span><kbd>&gt;</kbd> commands</span>{/if}
    </div>
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: 80; background: rgb(0 0 0 / .18); animation: fade .12s ease-out; }
  @keyframes fade { from { opacity: 0; } }
  .palette {
    position: fixed; z-index: 81; top: 12vh; left: 50%; transform: translateX(-50%); width: min(560px, calc(100vw - 24px));
    display: flex; flex-direction: column; max-height: 60vh; background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: var(--shadow), 0 24px 64px rgb(0 0 0 / .18); overflow: hidden; animation: pop .14s ease-out;
  }
  .head { display: flex; align-items: center; gap: 10px; padding: 0 14px; height: 48px; border-bottom: 1px solid var(--border); color: var(--text-faint); }
  .head input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 15px; color: var(--text); }
  .head input::placeholder { color: var(--text-faint); }
  .list { overflow-y: auto; padding: 6px; }
  .item {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 34px; padding: 0 10px; border: 0; border-radius: 7px;
    background: none; text-align: left; cursor: pointer; color: var(--text-muted);
  }
  .item.on { background: var(--bg-hover); color: var(--text); }
  .label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
  .label b { color: var(--accent); font-weight: 650; }
  .detail { flex: 1; min-width: 0; font-size: 11.5px; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kbd { margin-left: auto; font-size: 11px; color: var(--text-faint); font-family: var(--mono); }
  .item :global(svg) { flex: none; color: var(--text-faint); }
  .item:not(:has(.detail)):not(:has(.kbd)) .label { flex: 1; }
  .none { padding: 18px; text-align: center; color: var(--text-faint); }
  .foot { display: flex; gap: 12px; padding: 7px 12px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-faint); }
  .spacer { flex: 1; }
  kbd { font-family: var(--mono); font-size: 10px; padding: 0 4px; margin-right: 2px; border: 1px solid var(--border); border-radius: 3px; background: var(--bg); }
  @media (max-width: 760px) {
    .palette { top: calc(8px + env(safe-area-inset-top)); max-height: 70dvh; border-radius: 14px; }
    .head { height: 54px; }
    .head input { font-size: 16px; }
    .item { height: 46px; font-size: 15px; }
    .foot { display: none; }
  }
</style>
