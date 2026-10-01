<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';

  let { title, onclose, children, actions }: { title: string; onclose: () => void; children: Snippet; actions?: Snippet } = $props();
  let el = $state<HTMLElement>();

  function outside(e: PointerEvent) {
    const t = e.target as HTMLElement;
    // clicks on the footer toggle buttons are handled by the buttons themselves
    if (el && !el.contains(t) && !t.closest('footer') && !t.closest('.popover') && !t.closest('.mbar')) onclose();
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={(e) => e.key === 'Escape' && onclose()} />

<section class="panel" bind:this={el}>
  <header>
    <span>{title}</span>
    <div class="head-actions">
      {@render actions?.()}
      <button class="icon-btn" aria-label="Close" onclick={onclose}><X size={14} /></button>
    </div>
  </header>
  <div class="body">{@render children()}</div>
</section>

<style>
  .panel {
    position: absolute;
    left: 8px;
    bottom: 44px;
    width: calc(100% - 16px);
    min-width: 260px;
    max-height: min(560px, calc(100% - 60px));
    display: flex;
    flex-direction: column;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    z-index: 40;
    animation: pop .12s ease-out;
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 14px; border-bottom: 1px solid var(--border); font-weight: 600; }
  .head-actions { display: flex; align-items: center; gap: 4px; }
  .body { overflow-y: auto; padding: 10px 14px 14px; }
  /* phones: bottom sheet over everything */
  @media (max-width: 760px) {
    .panel {
      position: fixed; left: 0; right: 0; bottom: 0; width: 100%; min-width: 0; max-height: 85dvh; z-index: 60;
      border-radius: 16px 16px 0 0; box-shadow: 0 -8px 40px rgb(0 0 0 / .25); animation: rise .2s ease-out;
    }
    .body { padding: 12px 18px calc(18px + env(safe-area-inset-bottom)); }
    header { padding: 12px 10px 10px 18px; font-size: 15px; }
  }
  @keyframes rise { from { transform: translateY(24px); opacity: 0; } }
</style>
