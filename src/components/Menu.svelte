<script lang="ts">
  import { menu, closeMenu } from '../lib/menu.svelte';
  import { tick } from 'svelte';
  import { app } from '../lib/app.svelte';

  let el = $state<HTMLDivElement>();
  let pos = $state({ x: 0, y: 0 });

  // keep the menu inside the viewport, focus the first item
  $effect(() => {
    if (!menu.open) return;
    pos = { x: menu.x, y: menu.y };
    tick().then(() => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      pos = {
        x: Math.max(4, Math.min(menu.x, innerWidth - r.width - 8)),
        y: menu.y + r.height > innerHeight - 8 ? Math.max(4, menu.y - r.height) : menu.y,
      };
      el.querySelector<HTMLElement>('.menu-item')?.focus();
    });
  });

  function onKey(e: KeyboardEvent) {
    if (!menu.open) return;
    if (e.key === 'Escape') return closeMenu();
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(el?.querySelectorAll<HTMLElement>('.menu-item') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
</script>

<svelte:window onkeydown={onKey} onblur={closeMenu} />

{#if menu.open}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="backdrop" class:dim={app.narrow} onpointerdown={closeMenu} oncontextmenu={(e) => (e.preventDefault(), closeMenu())}></div>
  <div class="popover" class:sheet={app.narrow} role="menu" bind:this={el} style={app.narrow ? '' : `left:${pos.x}px;top:${pos.y}px`}>
    {#each menu.items as item, i (i)}
      {#if 'sep' in item}
        <div class="menu-sep"></div>
      {:else if 'heading' in item}
        <div class="menu-label">{item.heading}</div>
      {:else}
        <button
          class="menu-item"
          class:danger={item.danger}
          role="menuitem"
          onclick={() => {
            closeMenu();
            item.action();
          }}
        >
          {#if item.icon}<item.icon size={14} />{/if}
          {item.label}
          {#if item.kbd}<span class="kbd">{item.kbd}</span>{/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 49; }
  .backdrop.dim { background: rgb(0 0 0 / .3); animation: fade .15s ease-out; }
  @keyframes fade { from { opacity: 0; } }
  /* phones: menus become an action sheet in thumb reach */
  .sheet {
    left: 0; right: 0; bottom: 0; top: auto; min-width: 0; max-height: 80dvh; overflow-y: auto;
    padding: 8px 8px calc(10px + env(safe-area-inset-bottom)); border-radius: 16px 16px 0 0; animation: rise .2s ease-out;
  }
  .sheet::before { content: ''; display: block; width: 36px; height: 4px; margin: 0 auto 6px; border-radius: 2px; background: var(--border-strong); }
  .sheet :global(.menu-item) { height: 48px; font-size: 15px; gap: 12px; padding: 0 12px; }
  .sheet :global(.menu-label) { font-size: 12px; padding: 10px 12px 4px; }
  @keyframes rise { from { transform: translateY(24px); opacity: 0; } }
</style>
