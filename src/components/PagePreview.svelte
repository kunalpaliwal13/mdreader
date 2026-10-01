<script lang="ts">
  // Hovering a link to another note shows that note (or the linked section) in a small popover.
  import { app } from '../lib/app.svelte';
  import { renderToElement, section } from '../lib/render';

  let { path, heading, rect, onenter, onleave, onlink }: {
    path: string;
    heading: string;
    rect: DOMRect;
    onenter: () => void;
    onleave: () => void;
    onlink: (a: HTMLAnchorElement, from: string) => void;
  } = $props();

  let article: HTMLElement;
  const W = 440, H = 360, M = 8;

  // below the link, or above it when there's more room there; always inside the window
  const below = $derived(innerHeight - rect.bottom - M);
  const up = $derived(below < 220 && rect.top - M > below);
  const style = $derived(
    `left:${Math.max(M, Math.min(rect.left - 12, innerWidth - W - M))}px;` +
      (up ? `bottom:${innerHeight - rect.top + 6}px;max-height:${Math.min(H, rect.top - M - 6)}px` : `top:${rect.bottom + 6}px;max-height:${Math.min(H, below - 6)}px`),
  );

  $effect(() => {
    const p = path, h = heading;
    let alive = true;
    app
      .readText(p)
      .then((text) => renderToElement(text, { docPath: p, dark: app.dark, resolveWiki: (t, f) => app.resolveWiki(t, f), readNote: (x) => app.readText(x) }))
      .then(({ el, parsed }) => {
        // a heading link previews just that section
        if (alive) article.replaceChildren(...(section(el, parsed, h) ?? el.childNodes));
      });
    return () => (alive = false);
  });

  function onclick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    onlink(a, path);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
<div class="pp" {style} role="tooltip" onmouseenter={onenter} onmouseleave={onleave} {onclick}>
  <article
    bind:this={article}
    class="md preset-{app.settings.preset}"
    class:font-sans={app.settings.font === 'sans'}
    class:font-serif={app.settings.font === 'serif'}
    class:font-mono={app.settings.font === 'mono'}
  ></article>
</div>

<style>
  .pp {
    position: fixed; z-index: 45; width: min(440px, calc(100vw - 16px)); overflow-y: auto; overscroll-behavior: contain;
    border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); background: var(--bg-elevated);
    animation: pop .12s ease-out;
  }
  .pp .md { --pv-size: 14px; max-width: none; margin: 0; padding: 16px 20px 18px; }
  .pp .md :global(> :first-child) { margin-top: 0; }
</style>
