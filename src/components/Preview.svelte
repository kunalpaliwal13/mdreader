<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { renderToElement } from '../lib/render';
  import { resolveRel, isMarkdown } from '../lib/fs';

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
      const { el } = await renderToElement(job.text, { docPath: job.path, dark: job.dark });
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

<div class="scroller" bind:this={scroller}>
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
