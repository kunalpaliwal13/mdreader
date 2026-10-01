<script lang="ts">
  import { Search, X, CaseSensitive } from '@lucide/svelte';
  import { app } from '../lib/app.svelte';
  import { basename, dirname } from '../lib/fs';

  type Hit = { line: number; text: string; start: number; len: number };
  type Result = { path: string; nameHit: boolean; hits: Hit[] };

  let query = $state('');
  let caseSensitive = $state(false);
  let results = $state<Result[]>([]);
  let searching = $state(false);
  let input: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout>;
  let seq = 0;

  const MAX_HITS = 50;

  async function run(q: string, cs: boolean) {
    const id = ++seq;
    if (!q.trim()) return ((results = []), (searching = false));
    searching = true;
    const needle = cs ? q : q.toLowerCase();
    const out: Result[] = [];
    for (const { path, text } of await app.readAll()) {
      const hits: Hit[] = [];
      const lines = text.split('\n');
      for (let i = 0; i < lines.length && hits.length < MAX_HITS; i++) {
        const hay = cs ? lines[i] : lines[i].toLowerCase();
        const at = hay.indexOf(needle);
        if (at < 0) continue;
        // trim long lines around the match so the hit stays visible
        const from = Math.max(0, at - 24);
        const snippet = (from ? '…' : '') + lines[i].slice(from, at + needle.length + 80).trim();
        hits.push({ line: i + 1, text: snippet, start: snippet.indexOf(lines[i].slice(at, at + needle.length)), len: needle.length });
      }
      const name = cs ? basename(path) : basename(path).toLowerCase();
      if (hits.length || name.includes(needle)) out.push({ path, nameHit: name.includes(needle), hits });
    }
    if (id !== seq) return;
    results = out.sort((a, b) => Number(b.nameHit) - Number(a.nameHit) || b.hits.length - a.hits.length);
    searching = false;
  }

  $effect(() => {
    const q = query, cs = caseSensitive;
    clearTimeout(timer);
    timer = setTimeout(() => run(q, cs), 180);
  });

  const total = $derived(results.reduce((n, r) => n + r.hits.length, 0));

  function focus() {
    input?.focus();
    input?.select();
  }
  $effect(() => focus());
</script>

<div class="search">
  <label class="field">
    <Search size={13} />
    <input bind:this={input} bind:value={query} placeholder="Search in all files" onkeydown={(e) => e.key === 'Escape' && (query = '')} />
    <button class="icon-btn tiny" class:active={caseSensitive} title="Match case" aria-label="Match case" aria-pressed={caseSensitive} onclick={() => (caseSensitive = !caseSensitive)}><CaseSensitive size={14} /></button>
    {#if query}<button class="icon-btn tiny" aria-label="Clear search" onclick={() => (query = '')}><X size={12} /></button>{/if}
  </label>

  {#if query.trim()}
    <div class="summary">
      {#if searching}Searching…{:else if results.length}{total} {total === 1 ? 'match' : 'matches'} in {results.length} {results.length === 1 ? 'file' : 'files'}{:else}No results{/if}
    </div>
  {/if}

  <div class="results">
    {#each results as r (r.path)}
      <button class="file" onclick={() => app.openAt(r.path)} title={r.path}>
        <span class="name">{basename(r.path)}</span>
        {#if dirname(r.path)}<span class="dir">{dirname(r.path)}</span>{/if}
        {#if r.hits.length}<span class="count">{r.hits.length}</span>{/if}
      </button>
      {#each r.hits as h (h.line)}
        <button class="hit" onclick={() => app.openAt(r.path, h.line)}>
          <span class="ln">{h.line}</span>
          <span class="txt">{#if h.start >= 0}{h.text.slice(0, h.start)}<mark>{h.text.slice(h.start, h.start + h.len)}</mark>{h.text.slice(h.start + h.len)}{:else}{h.text}{/if}</span>
        </button>
      {/each}
    {/each}
  </div>
</div>

<style>
  .search { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  .field {
    display: flex; align-items: center; gap: 6px; margin: 0 8px 6px; padding: 0 4px 0 8px; height: 30px;
    border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); color: var(--text-faint);
  }
  .field:focus-within { border-color: var(--accent); }
  .field input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 12.5px; }
  .field input::placeholder { color: var(--text-faint); }
  .tiny { width: 22px; height: 22px; }
  .summary { padding: 2px 14px 6px; font-size: 11px; color: var(--text-faint); }
  .results { flex: 1; overflow-y: auto; padding: 0 6px 12px; }
  button { display: flex; align-items: baseline; gap: 6px; width: 100%; border: 0; background: none; text-align: left; cursor: pointer; border-radius: 5px; }
  button:hover { background: var(--bg-hover); }
  .file { padding: 6px 8px 3px; margin-top: 4px; color: var(--text); font-weight: 550; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dir { font-size: 11px; font-weight: 400; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .count { margin-left: auto; font-size: 10.5px; font-weight: 500; padding: 0 6px; border-radius: 8px; background: var(--bg-active); color: var(--text-muted); }
  .hit { padding: 3px 8px 3px 14px; font-size: 12px; color: var(--text-muted); }
  .ln { flex: none; min-width: 22px; color: var(--text-faint); font-family: var(--mono); font-size: 10.5px; text-align: right; }
  .txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  mark { background: color-mix(in srgb, #facc15 40%, transparent); color: var(--text); border-radius: 2px; padding: 0 1px; }
  .tiny.active { color: var(--accent); background: var(--accent-soft); }
</style>
