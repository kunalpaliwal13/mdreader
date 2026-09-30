<script lang="ts">
  import { RotateCcw, X, FileText, Folder } from '@lucide/svelte';
  import Panel from './Panel.svelte';
  import { app } from '../lib/app.svelte';
  import { basename, dirname } from '../lib/fs';

  let { onclose }: { onclose: () => void } = $props();

  const ago = (t: number) => {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(t).toLocaleDateString();
  };
</script>

<Panel title="Trash" {onclose}>
  {#snippet actions()}
    {#if app.trash.length}
      <button class="text-btn" onclick={() => confirm('Permanently delete everything in trash?') && app.emptyTrash()}>Empty</button>
    {/if}
  {/snippet}
  {#each app.trash as t (t.id)}
    <div class="item">
      {#if t.kind === 'dir'}<Folder size={14} />{:else}<FileText size={14} />{/if}
      <div class="info">
        <span class="name">{basename(t.path)}</span>
        <span class="meta">{dirname(t.path) || 'workspace'} · {ago(t.deletedAt)}</span>
      </div>
      <button class="icon-btn" title="Restore" aria-label="Restore" onclick={() => app.restore(t.id)}><RotateCcw size={13} /></button>
      <button class="icon-btn" title="Delete forever" aria-label="Delete forever" onclick={() => app.purge(t.id)}><X size={13} /></button>
    </div>
  {:else}
    <p class="empty">Trash is empty. Deleted files land here and can be restored.</p>
  {/each}
</Panel>

<style>
  .item { display: flex; align-items: center; gap: 8px; padding: 6px 0; color: var(--text-muted); }
  .item + .item { border-top: 1px solid var(--border); }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .name { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { font-size: 11px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { margin: 8px 0; color: var(--text-faint); font-size: 12px; line-height: 1.6; }
  .text-btn { border: 0; background: none; color: var(--danger); cursor: pointer; font-size: 12px; padding: 4px 6px; border-radius: 4px; }
  .text-btn:hover { background: var(--bg-hover); }
</style>
