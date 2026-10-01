<script lang="ts">
  import { RotateCcw } from '@lucide/svelte';
  import Panel from './Panel.svelte';
  import { app } from '../lib/app.svelte';
  import { fs, basename } from '../lib/fs';

  let { onclose }: { onclose: () => void } = $props();

  const path = $derived(app.historyOf ?? '');
  let versions = $state<{ at: number; size: number }[]>([]);
  let picked = $state<number | null>(null);
  let text = $state('');

  $effect(() => {
    const p = path;
    picked = null;
    if (p) fs.versions(p).then((v) => p === path && (versions = v));
  });

  async function pick(at: number) {
    picked = at;
    text = await fs.version(path, at);
  }

  // rough "what changed" hint against the current text: lines only in one side
  const delta = $derived.by(() => {
    if (picked === null) return null;
    const now = (app.texts[path] ?? '').split('\n'), then = text.split('\n');
    const count = (a: string[], b: string[]) => {
      const left = new Map<string, number>();
      for (const l of b) left.set(l, (left.get(l) ?? 0) + 1);
      return a.filter((l) => {
        const n = left.get(l) ?? 0;
        if (n) left.set(l, n - 1);
        return !n;
      }).length;
    };
    return { added: count(then, now), removed: count(now, then) };
  });

  const when = (t: number) => {
    const d = new Date(t), today = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
    return days === 0 ? `Today ${time}` : days === 1 ? `Yesterday ${time}` : `${d.toLocaleDateString()} ${time}`;
  };
  const size = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

  async function restore() {
    if (picked === null) return;
    await app.restoreVersion(path, picked);
    versions = await fs.versions(path);
    picked = null;
  }
</script>

<Panel title={'History · ' + basename(path).replace(/\.md$/i, '')} {onclose}>
  {#each versions as v (v.at)}
    <button class="item" class:on={picked === v.at} aria-pressed={picked === v.at} onclick={() => pick(v.at)}>
      <span class="when">{when(v.at)}</span>
      <span class="meta">{size(v.size)}</span>
    </button>
    {#if picked === v.at}
      <div class="peek">
        {#if delta}<div class="delta">vs now: <b class="add">+{delta.added}</b> <b class="del">−{delta.removed}</b> lines</div>{/if}
        <pre>{text}</pre>
        <button class="btn restore" onclick={restore}><RotateCcw size={13} /> Restore this version</button>
      </div>
    {/if}
  {:else}
    <p class="empty">No earlier versions yet. While you edit, mdreader keeps a version every few minutes (the last 50).</p>
  {/each}
</Panel>

<style>
  .item {
    display: flex; align-items: baseline; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 8px; border: 0;
    border-radius: 6px; background: none; color: var(--text); cursor: pointer; text-align: left; font-size: 12.5px;
  }
  .item:hover { background: var(--bg-hover); }
  .item.on { background: var(--accent-soft); }
  .meta { font-size: 11px; color: var(--text-faint); }
  .peek { margin: 2px 0 8px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); }
  .delta { margin-bottom: 6px; font-size: 11px; color: var(--text-faint); }
  .add { color: #16a34a; font-weight: 600; }
  .del { color: var(--danger); font-weight: 600; }
  pre {
    max-height: 180px; margin: 0 0 8px; overflow: auto; white-space: pre-wrap; word-break: break-word;
    font: 11px/1.5 var(--mono); color: var(--text-muted);
  }
  .restore { display: inline-flex; align-items: center; gap: 6px; }
  .empty { margin: 8px 0; color: var(--text-faint); font-size: 12px; line-height: 1.6; }
</style>
