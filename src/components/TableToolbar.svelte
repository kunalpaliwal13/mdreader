<script lang="ts">
  // Floats above a table while the cursor is in it (a CodeMirror tooltip, see lib/editor/table.ts).
  import type { Readable } from 'svelte/store';
  import {
    TextAlignStart, TextAlignCenter, TextAlignEnd, BetweenHorizontalStart, BetweenHorizontalEnd, BetweenVerticalStart,
    BetweenVerticalEnd, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, WandSparkles, Trash2, Ellipsis,
  } from '@lucide/svelte';
  import { openMenu, type MenuItem } from '../lib/menu.svelte';
  import type { TableAction, TableInfo } from '../lib/editor/table';

  let { info, run }: { info: Readable<TableInfo>; run: (a: TableAction) => void } = $props();

  const aligns = [
    { a: 'left', action: 'alignLeft', label: 'Align left', icon: TextAlignStart },
    { a: 'center', action: 'alignCenter', label: 'Align center', icon: TextAlignCenter },
    { a: 'right', action: 'alignRight', label: 'Align right', icon: TextAlignEnd },
  ] as const;

  function more(e: MouseEvent) {
    const { row, col, rows, cols } = $info;
    const body = row > 0;
    const groups: MenuItem[][] = [
      [
        ...(body ? [{ label: 'Insert row above', icon: BetweenHorizontalStart, action: () => run('rowAbove') }] : []),
        { label: 'Insert row below', icon: BetweenHorizontalEnd, action: () => run('rowBelow') },
        { label: 'Insert column left', icon: BetweenVerticalStart, action: () => run('colLeft') },
        { label: 'Insert column right', icon: BetweenVerticalEnd, action: () => run('colRight') },
      ],
      [
        ...(row > 1 ? [{ label: 'Move row up', icon: ArrowUp, action: () => run('rowUp') }] : []),
        ...(body && row < rows - 1 ? [{ label: 'Move row down', icon: ArrowDown, action: () => run('rowDown') }] : []),
        ...(col > 0 ? [{ label: 'Move column left', icon: ArrowLeft, action: () => run('colMoveLeft') }] : []),
        ...(col < cols - 1 ? [{ label: 'Move column right', icon: ArrowRight, action: () => run('colMoveRight') }] : []),
      ],
      [
        { label: 'Format table', icon: WandSparkles, action: () => run('format') },
        ...(body ? [{ label: 'Delete row', icon: Trash2, danger: true, action: () => run('deleteRow') }] : []),
        ...(cols > 1 ? [{ label: 'Delete column', icon: Trash2, danger: true, action: () => run('deleteCol') }] : []),
      ],
    ];
    const items = groups.filter((g) => g.length).flatMap((g, i) => (i ? [{ sep: true } as const, ...g] : g));
    openMenu(e, items, e.currentTarget as HTMLElement);
  }
</script>

<!-- mousedown would take focus from the editor, the cursor would leave the table and the toolbar would vanish -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tt" role="toolbar" aria-label="Table" tabindex="-1" onmousedown={(e) => e.preventDefault()}>
  {#each aligns as x (x.a)}
    <button class:on={$info.align === x.a} aria-pressed={$info.align === x.a} aria-label={x.label} title={x.label} onclick={() => run(x.action)}>
      <x.icon size={13} />
    </button>
  {/each}
  <span class="sep"></span>
  <button aria-label="Add row below" title="Add row below" onclick={() => run('rowBelow')}><BetweenHorizontalEnd size={13} /></button>
  <button aria-label="Add column right" title="Add column right" onclick={() => run('colRight')}><BetweenVerticalEnd size={13} /></button>
  <span class="sep"></span>
  <button aria-label="More table actions" title="More" onclick={more}><Ellipsis size={13} /></button>
</div>

<style>
  /* 22px tall: fits inside the blank line next to the table */
  .tt { display: flex; align-items: center; gap: 1px; padding: 1px; font-family: var(--font); }
  button {
    display: grid; place-items: center; width: 24px; height: 20px; border: 0; border-radius: 5px;
    background: none; color: var(--text-muted); cursor: pointer;
  }
  button:hover { background: var(--bg-hover); color: var(--text); }
  button.on { background: var(--accent-soft); color: var(--accent); }
  .sep { width: 1px; height: 14px; margin: 0 4px; background: var(--border); }
  @media (pointer: coarse) { button { width: 34px; height: 24px; } }
</style>
