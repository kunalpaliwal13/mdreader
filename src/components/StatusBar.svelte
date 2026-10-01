<script lang="ts">
  import { app } from '../lib/app.svelte';

  // strip code fences / markup before counting so words ≈ what a reader sees
  const words = $derived.by(() => {
    const t = app.activeText
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_`~=\[\]()|-]/g, ' ');
    return (t.match(/\S+/g) ?? []).length;
  });
  const minutes = $derived(Math.max(1, Math.round(words / 230)));
  const label = { saved: 'Saved', saving: 'Saving…', unsaved: 'Editing', error: 'Save failed' };
</script>

<footer class="status">
  <span class="save {app.saveState}"><i></i>{label[app.saveState]}</span>
  {#if app.active}
    {#if app.settings.plain}<button class="chip" title="Smart typing paused — click to restore" onclick={() => app.togglePlain()}>Plain</button>{/if}
    {#if app.vimMode && app.mode !== 'preview'}<span class="vim" title="Vim keys (Settings → Editor)">{app.vimMode.toUpperCase()}</span>{/if}
    <span class="spacer"></span>
    {#if app.mode !== 'preview' && !app.narrow}<span>Ln {app.cursor.line}, Col {app.cursor.col}</span>{/if}
    <span>{words.toLocaleString()} {words === 1 ? 'word' : 'words'}</span>
    {#if words}<span>{minutes} min read</span>{/if}
  {/if}
</footer>

<style>
  .vim { font-family: var(--mono); font-size: 10px; letter-spacing: .04em; color: var(--accent); }
  .status {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 24px;
    padding: 0 12px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
    background: var(--bg);
    white-space: nowrap;
    overflow: hidden;
  }
  .spacer { flex: 1; }
  .chip { height: 16px; padding: 0 7px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent-soft); color: var(--accent); font-size: 10.5px; font-weight: 600; cursor: pointer; }
  .save { display: flex; align-items: center; gap: 6px; }
  .save i { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
  .save.unsaved i, .save.saving i { background: #f59e0b; }
  .save.error { color: var(--danger); }
  .save.error i { background: var(--danger); }
</style>
