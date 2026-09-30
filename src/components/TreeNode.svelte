<script lang="ts" module>
  import type { TreeNode as Node } from '../lib/tree';
  export type TreeCtx = {
    isOpen: (p: string) => boolean;
    click: (e: MouseEvent, n: Node) => void;
    menu: (e: MouseEvent, n: Node, anchor?: HTMLElement) => void;
    dragStart: (e: DragEvent, n: Node) => void;
    dragOver: (e: DragEvent, dir: string) => void;
    drop: (e: DragEvent, dir: string) => void;
    dropTarget: () => string | null;
  };
</script>

<script lang="ts">
  import { ChevronRight, Folder, FolderOpen, FileText, Image, File, Ellipsis } from '@lucide/svelte';
  import Self from './TreeNode.svelte';
  import { app } from '../lib/app.svelte';
  import { dirname, isMarkdown, isImage } from '../lib/fs';

  let { node, depth, ctx }: { node: Node; depth: number; ctx: TreeCtx } = $props();

  const open = $derived(node.kind === 'dir' && ctx.isOpen(node.path));
  const dropDir = $derived(node.kind === 'dir' ? node.path : dirname(node.path));

  function focusInput(el: HTMLInputElement) {
    el.focus();
    const dot = node.kind === 'file' ? el.value.lastIndexOf('.') : -1;
    el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
  }

  function renameKey(e: KeyboardEvent) {
    const input = e.currentTarget as HTMLInputElement;
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = node.name;
      input.blur();
    }
    e.stopPropagation();
  }
</script>

<div
  class="row"
  class:active={app.active === node.path}
  class:selected={app.selected.has(node.path)}
  class:drop={node.kind === 'dir' && ctx.dropTarget() === node.path}
  style="padding-left:{8 + depth * 14}px"
  role="treeitem"
  aria-selected={app.selected.has(node.path)}
  aria-expanded={node.kind === 'dir' ? open : undefined}
  tabindex="-1"
  data-path={node.path}
  draggable={app.renaming !== node.path}
  onclick={(e) => ctx.click(e, node)}
  ondblclick={() => (app.renaming = node.path)}
  oncontextmenu={(e) => ctx.menu(e, node)}
  ondragstart={(e) => ctx.dragStart(e, node)}
  ondragover={(e) => ctx.dragOver(e, dropDir)}
  ondrop={(e) => ctx.drop(e, dropDir)}
  onkeydown={() => {}}
>
  {#if node.kind === 'dir'}
    <span class="chev" class:open><ChevronRight size={12} /></span>
    {#if open}<FolderOpen size={14} />{:else}<Folder size={14} />{/if}
  {:else}
    <span class="chev"></span>
    {#if isMarkdown(node.path)}<FileText size={14} />{:else if isImage(node.path)}<Image size={14} />{:else}<File size={14} />{/if}
  {/if}

  {#if app.renaming === node.path}
    <input
      class="rename"
      value={node.name}
      use:focusInput
      onkeydown={renameKey}
      onclick={(e) => e.stopPropagation()}
      onblur={(e) => app.rename(node.path, (e.currentTarget as HTMLInputElement).value)}
    />
  {:else}
    <span class="name">{node.name}</span>
    <button
      class="more icon-btn"
      aria-label="More actions"
      onclick={(e) => ctx.menu(e, node, e.currentTarget as HTMLElement)}
    ><Ellipsis size={14} /></button>
  {/if}
</div>

{#if open}
  {#each node.children as child (child.path)}
    <Self node={child} depth={depth + 1} {ctx} />
  {/each}
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding-right: 4px;
    margin: 0 6px;
    border-radius: var(--radius);
    color: var(--text-muted);
    cursor: default;
    user-select: none;
  }
  .row:hover { background: var(--bg-hover); color: var(--text); }
  .row.active { background: var(--bg-active); color: var(--text); }
  .row.selected { background: var(--accent-soft); color: var(--text); }
  .row.drop { background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent); }
  .row :global(svg) { flex: none; }
  .chev { display: inline-grid; place-items: center; width: 12px; color: var(--text-faint); transition: transform .12s; }
  .chev.open { transform: rotate(90deg); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { width: 20px; height: 20px; opacity: 0; }
  .row:hover .more, .more:focus-visible { opacity: 1; }
  .rename {
    flex: 1; min-width: 0; height: 22px; padding: 0 6px; border: 1px solid var(--accent); border-radius: 4px;
    background: var(--bg); outline: none;
  }
  @media (hover: none) { .more { opacity: 1; } }
</style>
