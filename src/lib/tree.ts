import type { Entry } from './fs';

export type TreeNode = { name: string; path: string; kind: 'file' | 'dir'; children: TreeNode[] };

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Flat entries -> sorted tree (folders first). With a filter, keep matching files + their ancestors. */
export function buildTree(entries: Entry[], filter = ''): TreeNode[] {
  const q = filter.trim().toLowerCase();
  let list = entries;
  if (q) {
    const keep = new Set<string>();
    for (const e of entries) {
      const name = e.path.split('/').pop()!.toLowerCase();
      if (name.includes(q)) {
        const parts = e.path.split('/');
        for (let i = 1; i <= parts.length; i++) keep.add(parts.slice(0, i).join('/'));
      }
    }
    list = entries.filter((e) => keep.has(e.path));
  }
  const root: TreeNode = { name: '', path: '', kind: 'dir', children: [] };
  const byPath = new Map<string, TreeNode>([['', root]]);
  for (const e of [...list].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    const parent = byPath.get(e.path.split('/').slice(0, -1).join('/'));
    if (!parent) continue;
    const node: TreeNode = { name: e.path.split('/').pop()!, path: e.path, kind: e.kind, children: [] };
    parent.children.push(node);
    byPath.set(e.path, node);
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'dir' ? -1 : 1) : collator.compare(a.name, b.name)));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

/** Visible rows in display order (for shift-click ranges and keyboard nav). */
export function visibleRows(nodes: TreeNode[], isOpen: (p: string) => boolean, out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.kind === 'dir' && isOpen(n.path)) visibleRows(n.children, isOpen, out);
  }
  return out;
}
