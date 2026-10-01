<script lang="ts">
  import { Link2 } from '@lucide/svelte';
  import { app } from '../lib/app.svelte';
  import { basename, dirname, resolveRel } from '../lib/fs';

  type Mention = { path: string; line: number; text: string };

  // heading that contains the cursor
  const current = $derived(app.headings.findLast((h) => h.line <= app.cursor.line)?.line ?? -1);
  const min = $derived(Math.min(...app.headings.map((h) => h.level)));

  let mentions = $state<Mention[]>([]);
  let seq = 0;

  async function findBacklinks(target: string) {
    const id = ++seq;
    const out: Mention[] = [];
    for (const { path, text } of await app.readAll()) {
      if (path === target) continue;
      text.split('\n').forEach((line, i) => {
        const wiki = [...line.matchAll(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g)].some((m) => app.resolveWiki(m[1], path) === target);
        const md = [...line.matchAll(/\]\(([^)\s]+)\)/g)].some((m) => resolveRel(path, m[1]) === target);
        if (wiki || md) out.push({ path, line: i + 1, text: line.trim().slice(0, 140) });
      });
    }
    if (id === seq) mentions = out;
  }

  $effect(() => {
    // re-scan when the file or the workspace changes
    void app.entries;
    if (app.active) findBacklinks(app.active);
    else mentions = [];
  });
</script>

<div class="outline">
  {#if !app.active}
    <p class="empty">Open a file to see its outline.</p>
  {:else}
    <div class="section">Outline</div>
    {#each app.headings as h (h.id)}
      <button
        class="heading"
        class:current={h.line === current}
        style="padding-left:{10 + (h.level - min) * 12}px"
        onclick={() => app.revealLine(h.line)}
      >{h.text}</button>
    {:else}
      <p class="empty">No headings yet. Lines starting with <code>#</code> appear here.</p>
    {/each}

    <div class="section">Linked mentions {#if mentions.length}<span class="count">{mentions.length}</span>{/if}</div>
    {#each mentions as m (m.path + m.line)}
      <button class="mention" onclick={() => app.openAt(m.path, m.line)} title={m.path}>
        <span class="from"><Link2 size={12} /> {basename(m.path)}{#if dirname(m.path)}<em>{dirname(m.path)}</em>{/if}</span>
        <span class="snippet">{m.text}</span>
      </button>
    {:else}
      <p class="empty">No other file links here. Link with <code>[[{basename(app.active).replace(/\.md$/i, '')}]]</code>.</p>
    {/each}
  {/if}
</div>

<style>
  .outline { flex: 1; overflow-y: auto; padding: 0 6px 16px; }
  .section { display: flex; align-items: center; gap: 6px; padding: 10px 10px 4px; font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: .04em; }
  .count { font-weight: 500; padding: 0 6px; border-radius: 8px; background: var(--bg-active); color: var(--text-muted); text-transform: none; }
  button { display: block; width: 100%; border: 0; background: none; text-align: left; cursor: pointer; border-radius: 5px; color: var(--text-muted); }
  button:hover { background: var(--bg-hover); color: var(--text); }
  .heading { position: relative; padding-top: 4px; padding-bottom: 4px; padding-right: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .heading.current { color: var(--text); font-weight: 550; }
  .heading.current::before { content: ''; position: absolute; left: 2px; top: 6px; bottom: 6px; width: 2px; border-radius: 1px; background: var(--accent); }
  .mention { padding: 6px 10px; }
  .from { display: flex; align-items: center; gap: 5px; color: var(--text); font-weight: 500; }
  .from em { font-style: normal; font-weight: 400; font-size: 11px; color: var(--text-faint); }
  .snippet { display: block; margin-top: 2px; font-size: 12px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { margin: 4px 10px; font-size: 12px; color: var(--text-faint); line-height: 1.6; }
  code { font-family: var(--mono); font-size: 11px; padding: 0 3px; border-radius: 3px; background: var(--bg-active); }
</style>
