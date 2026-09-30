<script lang="ts">
  import { menu, closeMenu } from '../lib/menu.svelte';
  import { tick } from 'svelte';

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
  <div class="backdrop" onpointerdown={closeMenu} oncontextmenu={(e) => (e.preventDefault(), closeMenu())}></div>
  <div class="popover" role="menu" bind:this={el} style="left:{pos.x}px;top:{pos.y}px">
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
</style>
