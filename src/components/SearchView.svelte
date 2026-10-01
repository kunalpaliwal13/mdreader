<script lang="ts">
  import { Search, X, CaseSensitive, WholeWord, Regex, UnfoldVertical, ListFilter, Folder } from '@lucide/svelte';
  import { app } from '../lib/app.svelte';
  import { basename, dirname } from '../lib/fs';
  import { matcher, ranges, globs, included, searchText, type Hit, type Range } from '../lib/search';
  import { TAG_QUERY } from '../lib/tags';

  type Result = { path: string; dir: boolean; name: Range[]; hits: Hit[]; count: number };

  // options stick between visits (per browser)
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem('mdr.search') ?? '{}');
    } catch {
      return {};
    }
  })();
  let caseSensitive = $state<boolean>(saved.caseSensitive ?? false);
  let wholeWord = $state<boolean>(saved.wholeWord ?? false);
  let regex = $state<boolean>(saved.regex ?? false);
  let context = $state<boolean>(saved.context ?? false);
  let include = $state<string>(saved.include ?? '');
  let exclude = $state<string>(saved.exclude ?? '');
  let filters = $state<boolean>(!!(saved.include || saved.exclude));
  $effect(() => {
    try {
      localStorage.setItem('mdr.search', JSON.stringify({ caseSensitive, wholeWord, regex, context, include, exclude }));
    } catch {
      /* private mode: options just don't persist */
    }
  });

  let results = $state<Result[]>([]);
  let error = $state('');
  let searching = $state(false);
  let input: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout>;
  let seq = 0;

  const MAX_LINES = 50; // matching lines shown per file
  const MAX_TOTAL = 2000;

  async function run() {
    const id = ++seq;
    const query = app.searchQuery;
    const re = matcher({ query, caseSensitive, wholeWord, regex });
    const tag = !regex && TAG_QUERY.test(query) ? query.slice(1) : undefined;
    error = re instanceof Error ? 'Invalid regular expression' : '';
    if (!re || re instanceof Error) return ((results = []), (searching = false));
    searching = true;
    const inc = globs(include), exc = globs(exclude);
    const out: Result[] = [];
    // names match too (folders, then files), listed first; content hits follow
    for (const e of app.entries)
      if (e.kind === 'dir' && included(e.path, [], exc)) {
        const name = ranges(re, basename(e.path));
        if (name.length) out.push({ path: e.path, dir: true, name, hits: [], count: 0 });
      }
    const texts = new Map((await app.readAll()).map((f) => [f.path, f.text]));
    let total = 0;
    for (const e of app.entries) {
      const path = e.path;
      if (e.kind !== 'file' || !included(path, inc, exc)) continue;
      const name = ranges(re, basename(path));
      const text = texts.get(path);
      const { hits, count } = text === undefined || total >= MAX_TOTAL ? { hits: [], count: 0 } : searchText(re, text, context, MAX_LINES, tag);
      total += count;
      if (count || name.length) out.push({ path, dir: false, name, hits, count });
    }
    if (id !== seq) return;
    const rank = (r: Result) => (r.name.length ? (r.dir ? 2 : 1) : 0);
    results = out.sort((a, b) => rank(b) - rank(a) || b.count - a.count);
    searching = false;
  }

  $effect(() => {
    void [app.searchQuery, caseSensitive, wholeWord, regex, context, include, exclude];
    clearTimeout(timer);
    timer = setTimeout(run, 180);
  });

  const total = $derived(results.reduce((n, r) => n + r.count, 0));
  const withHits = $derived(results.filter((r) => r.count).length);
  const names = $derived(results.filter((r) => r.name.length).length);
  const filtered = $derived(!!(include.trim() || exclude.trim()));

  /** Enter: the top result (its first hit if it has one); searches now if the debounce hasn't fired yet. */
  async function openTop() {
    clearTimeout(timer);
    await run();
    const r = results[0];
    const h = r?.hits.find((x) => !x.context);
    if (r && h) app.openAt(r.path, h.line, h.first);
    else if (r) reveal(r);
  }

  // ↑/↓ walk the input and the result rows
  let box: HTMLElement;
  function arrows(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [input, ...box.querySelectorAll<HTMLElement>('.results button')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') app.searchQuery = '';
    if (e.key === 'Enter') return openTop();
    // VS Code muscle memory: Alt+C / Alt+W / Alt+R
    if (!e.altKey || e.metaKey || e.ctrlKey) return;
    const k = e.code;
    if (k === 'KeyC') caseSensitive = !caseSensitive;
    else if (k === 'KeyW') wholeWord = !wholeWord;
    else if (k === 'KeyR') regex = !regex;
    else return;
    e.preventDefault();
  }

  function reveal(r: Result) {
    if (!r.dir) return app.openAt(r.path);
    const parts = r.path.split('/');
    for (let i = 1; i <= parts.length; i++) app.expanded.add(parts.slice(0, i).join('/'));
    app.saveExpanded();
    app.selected.clear();
    app.selected.add(r.path);
    app.sidebarView = 'files';
  }

  $effect(() => {
    input?.focus();
    input?.select();
  });

  // with nothing typed, the workspace's tags (click one to search it)
  let tags = $state<[string, number][]>([]);
  $effect(() => {
    void app.entries.length;
    if (!app.searchQuery.trim()) app.allTags().then((t) => (tags = t));
  });
</script>

{#snippet marked(text: string, marks: Range[])}
  {#each marks as [a, b], i (i)}{text.slice(i ? marks[i - 1][1] : 0, a)}<mark>{text.slice(a, b)}</mark>{/each}{text.slice(marks.at(-1)?.[1] ?? 0)}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="search" bind:this={box} onkeydown={arrows}>
  <label class="field" class:invalid={!!error}>
    <Search size={13} />
    <input bind:this={input} bind:value={app.searchQuery} placeholder="Search in all files" spellcheck="false" onkeydown={onKey} />
    {#if app.searchQuery}<button class="icon-btn tiny" aria-label="Clear search" onclick={() => (app.searchQuery = '')}><X size={12} /></button>{/if}
    <button class="icon-btn tiny" class:active={caseSensitive} title="Match case (Alt+C)" aria-label="Match case" aria-pressed={caseSensitive} onclick={() => (caseSensitive = !caseSensitive)}><CaseSensitive size={14} /></button>
    <button class="icon-btn tiny" class:active={wholeWord} title="Match whole word (Alt+W)" aria-label="Match whole word" aria-pressed={wholeWord} onclick={() => (wholeWord = !wholeWord)}><WholeWord size={14} /></button>
    <button class="icon-btn tiny" class:active={regex} title="Use regular expression (Alt+R)" aria-label="Use regular expression" aria-pressed={regex} onclick={() => (regex = !regex)}><Regex size={14} /></button>
  </label>

  <div class="bar">
    <span class="summary" role="status">
      {#if error}<span class="err">{error}</span>
      {:else if !app.searchQuery}&nbsp;
      {:else if searching}Searching…
      {:else if results.length}
        {#if withHits}{total}{total >= MAX_TOTAL ? '+' : ''} {total === 1 ? 'match' : 'matches'} in {withHits} {withHits === 1 ? 'file' : 'files'}{/if}{#if withHits && names} · {/if}{#if names}{names} by name{/if}
      {:else}No results{/if}
      {#if filtered && !filters}<button class="chip" onclick={() => (filters = true)}>· filtered</button>{/if}
    </span>
    <button class="icon-btn tiny" class:active={context} title="Show a line of context around matches" aria-label="Context lines" aria-pressed={context} onclick={() => (context = !context)}><UnfoldVertical size={13} /></button>
    <button class="icon-btn tiny" class:active={filters || filtered} title="Files to include / exclude" aria-label="File filters" aria-expanded={filters} onclick={() => (filters = !filters)}><ListFilter size={13} /></button>
  </div>
  {#if filters}
    <div class="globs">
      <input bind:value={include} placeholder="Include: notes/**, *.md" aria-label="Files to include" spellcheck="false" />
      <input bind:value={exclude} placeholder="Exclude: Archive/, drafts/*" aria-label="Files to exclude" spellcheck="false" />
    </div>
  {/if}

  <div class="results">
    {#if !app.searchQuery.trim() && tags.length}
      <div class="tags-head">Tags</div>
      <div class="tags">
        {#each tags as [t, n] (t)}
          <button class="tag" onclick={() => (app.searchQuery = '#' + t)}>#{t}<span>{n}</span></button>
        {/each}
      </div>
    {/if}
    {#each results as r (r.path)}
      <button class="file" onclick={() => reveal(r)} title={r.path}>
        {#if r.dir}<Folder size={12} />{/if}
        <span class="name">{#if r.name.length}{@render marked(basename(r.path), r.name)}{:else}{basename(r.path)}{/if}</span>
        {#if dirname(r.path)}<span class="dir">{dirname(r.path)}</span>{/if}
        {#if r.count}<span class="count">{r.count}</span>{/if}
      </button>
      {#each r.hits as h, i (h.line)}
        <button
          class="hit"
          class:ctx={h.context}
          class:gap={i > 0 && h.line !== r.hits[i - 1].line + 1}
          onclick={() => app.openAt(r.path, h.line, h.first)}
        >
          <span class="ln">{h.line}</span>
          <span class="txt">{@render marked(h.text, h.marks)}</span>
        </button>
      {/each}
    {/each}
  </div>
</div>

<style>
  .search { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  .field {
    display: flex; align-items: center; gap: 2px; margin: 0 8px 2px; padding: 0 3px 0 8px; height: 30px;
    border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); color: var(--text-faint);
  }
  .field:focus-within { border-color: var(--accent); }
  .field.invalid { border-color: var(--danger); }
  .field input { flex: 1; min-width: 0; margin-left: 4px; border: 0; outline: 0; background: none; font-size: 12.5px; }
  .field input::placeholder { color: var(--text-faint); }
  .tiny { width: 22px; height: 22px; flex: none; }
  .tiny.active { color: var(--accent); background: var(--accent-soft); }
  .bar { display: flex; align-items: center; gap: 1px; padding: 0 11px 4px 14px; min-height: 26px; }
  .summary { flex: 1; min-width: 0; font-size: 11px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .err { color: var(--danger); }
  .tags-head { padding: 6px 8px 4px; font-size: 10.5px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: .05em; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 6px; }
  button.tag {
    display: inline-flex; align-items: baseline; gap: 5px; padding: 2px 8px; border: 0; border-radius: 10px; cursor: pointer;
    background: var(--accent-soft); color: var(--accent); font-size: 12px;
  }
  button.tag:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
  button.tag span { font-size: 10.5px; color: var(--text-faint); }
  .chip { border: 0; padding: 0 2px; background: none; color: var(--accent); font: inherit; cursor: pointer; }
  .globs { display: flex; flex-direction: column; gap: 4px; margin: 0 8px 6px; }
  .globs input {
    height: 26px; padding: 0 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg);
    font-size: 12px; font-family: var(--mono); outline: 0;
  }
  .globs input:focus { border-color: var(--accent); }
  .globs input::placeholder { font-family: var(--font); color: var(--text-faint); }
  .results { flex: 1; overflow-y: auto; padding: 0 6px 12px; }
  button.file, button.hit { display: flex; align-items: baseline; gap: 6px; width: 100%; border: 0; background: none; text-align: left; cursor: pointer; border-radius: 5px; }
  button.file:hover, button.hit:hover { background: var(--bg-hover); }
  .file { padding: 6px 8px 3px; margin-top: 4px; color: var(--text); font-weight: 550; }
  .file :global(svg) { flex: none; align-self: center; color: var(--text-faint); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dir { font-size: 11px; font-weight: 400; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .count { margin-left: auto; font-size: 10.5px; font-weight: 500; padding: 0 6px; border-radius: 8px; background: var(--bg-active); color: var(--text-muted); }
  .hit { padding: 3px 8px 3px 14px; font-size: 12px; color: var(--text-muted); }
  .hit.ctx { color: var(--text-faint); padding-top: 1px; padding-bottom: 1px; }
  .hit.gap { margin-top: 6px; }
  .ln { flex: none; min-width: 22px; color: var(--text-faint); font-family: var(--mono); font-size: 10.5px; text-align: right; }
  .txt { overflow: hidden; text-overflow: ellipsis; white-space: pre; }
  mark { background: color-mix(in srgb, #facc15 40%, transparent); color: var(--text); border-radius: 2px; padding: 0 1px; }
  @media (pointer: coarse) {
    .tiny { width: 30px; height: 30px; }
    .field { height: 38px; }
    .hit { padding-top: 7px; padding-bottom: 7px; }
  }
</style>
