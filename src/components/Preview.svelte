<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { renderToElement } from '../lib/render';
  import { onMount } from 'svelte';
  import { resolveRel, isMarkdown, dirname } from '../lib/fs';

  let { path, text }: { path: string; text: string } = $props();
  let article: HTMLElement;
  let scroller: HTMLElement;

  // Coalesce renders: at most one in flight, then render the latest input.
  let busy = false;
  let queued: { path: string; text: string; dark: boolean } | null = null;
  let lastPath = '';

  async function run(job: { path: string; text: string; dark: boolean }) {
    busy = true;
    try {
      const { el, parsed } = await renderToElement(job.text, {
        docPath: job.path,
        dark: job.dark,
        resolveWiki: (t) => app.resolveWiki(t, job.path),
      });
      app.headings = parsed.headings;
      el.querySelectorAll('input[type=checkbox]').forEach((i) => i.removeAttribute('disabled'));
      article.replaceChildren(...el.childNodes);
      if (job.path !== lastPath) scroller.scrollTop = 0;
      lastPath = job.path;
    } finally {
      busy = false;
      if (queued) {
        const next = queued;
        queued = null;
        run(next);
      }
    }
  }

  // ---- scroll sync: map source lines <-> preview offsets via data-sourcepos ----
  const BLOCK = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'PRE', 'TABLE', 'TR', 'BLOCKQUOTE', 'DIV', 'HR', 'DT', 'DD', 'FIGURE']);
  let ignoreUntil = 0;

  function marks(): { line: number; top: number }[] {
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const out: { line: number; top: number }[] = [];
    for (const el of article.querySelectorAll<HTMLElement>('[data-sourcepos]')) {
      if (!BLOCK.has(el.tagName)) continue;
      const line = parseInt(el.dataset.sourcepos!);
      const top = el.getBoundingClientRect().top - base;
      const last = out.at(-1);
      // keep lines and offsets both increasing (nested blocks share lines)
      if (!last || (line > last.line && top >= last.top)) out.push({ line, top });
    }
    return out;
  }

  function scrollToLine(l: number) {
    const m = marks();
    if (!m.length) return;
    let top = 0;
    if (l >= m[0].line) {
      let i = m.findLastIndex((x) => x.line <= l);
      const a = m[i], b = m[i + 1];
      top = b ? a.top + ((l - a.line) / (b.line - a.line)) * (b.top - a.top) : a.top;
      top -= 16;
    }
    ignoreUntil = performance.now() + 120;
    scroller.scrollTop = top;
  }

  function onScroll() {
    if (performance.now() < ignoreUntil || app.mode !== 'split') return;
    const m = marks();
    if (!m.length) return;
    const y = scroller.scrollTop + 16;
    if (scroller.scrollTop <= 0) return app.scrollEditorTo?.(1);
    const i = Math.max(0, m.findLastIndex((x) => x.top <= y));
    const a = m[i], b = m[i + 1];
    app.scrollEditorTo?.(b ? a.line + ((y - a.top) / Math.max(1, b.top - a.top)) * (b.line - a.line) : a.line);
  }

  onMount(() => {
    app.scrollPreviewTo = scrollToLine;
    return () => (app.scrollPreviewTo = null);
  });

  $effect(() => {
    const job = { path, text, dark: app.dark };
    if (busy) queued = job;
    else run(job);
  });

  function toggleTask(input: HTMLInputElement) {
    const pos = input.closest('[data-sourcepos]')?.getAttribute('data-sourcepos');
    const line = pos ? parseInt(pos) : NaN;
    if (!line) return;
    const lines = text.split('\n');
    const src = lines[line - 1] ?? '';
    const next = src.replace(/\[( |x|X)\]/, (_, c) => (c === ' ' ? '[x]' : '[ ]'));
    if (next === src) return;
    const from = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    app.edit(path, from, from + src.length, next);
  }

  function onClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement && t.type === 'checkbox') {
      e.preventDefault();
      return toggleTask(t);
    }
    if (t.classList.contains('code-copy')) {
      const code = t.closest('pre')?.querySelector('code')?.textContent ?? '';
      navigator.clipboard?.writeText(code).then(() => {
        t.textContent = 'Copied';
        setTimeout(() => (t.textContent = 'Copy'), 1200);
      });
      return;
    }
    const a = t.closest('a');
    const href = a?.getAttribute('href');
    if (!a || !href) return;
    if (a.dataset.wikilink) {
      e.preventDefault();
      if (a.dataset.path) app.open(a.dataset.path);
      else {
        // Obsidian-style: following a link to a missing note creates it
        const name = (a.dataset.target ?? 'Untitled').replace(/[\\:*?"<>|]/g, '-');
        app.createFile(dirname(path), name.endsWith('.md') ? name : name + '.md', `# ${name}\n\n`).then(() => (app.renaming = null));
      }
      return;
    }
    if (href.startsWith('#')) {
      e.preventDefault();
      const id = decodeURIComponent(href.slice(1));
      article.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const target = resolveRel(path, href);
    if (target !== null) {
      e.preventDefault();
      if (isMarkdown(target) && app.entries.some((x) => x.path === target)) app.open(target);
      else app.notify(`Not found in workspace: ${target}`, 'error');
    }
  }
</script>

<div class="scroller" bind:this={scroller} onscroll={() => requestAnimationFrame(onScroll)}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <article
    bind:this={article}
    class="md preset-{app.settings.preset}"
    class:font-sans={app.settings.font === 'sans'}
    class:font-serif={app.settings.font === 'serif'}
    class:font-mono={app.settings.font === 'mono'}
    style="--pv-size:{app.settings.size}px;--pv-width:{app.settings.width}px"
    onclick={onClick}
  ></article>
</div>

<style>
  .scroller { height: 100%; overflow-y: auto; background: var(--pv-bg, var(--bg)); }
  .scroller:has(:global(.preset-sepia)) { background: #f8f1e3; }
  :global([data-theme='dark']) .scroller:has(:global(.preset-sepia)) { background: #1e1913; }
</style>
