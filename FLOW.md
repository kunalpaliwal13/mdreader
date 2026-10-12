# Flow

- `src/lib/fs.worker.ts` — all storage (OPFS / disk folder / memory). `list()` walks the tree, returns `{path, kind, mtime}`.
- `src/lib/app.svelte.ts` — app state; `refresh()` loads `entries` from the worker.
- `src/lib/tree.ts` — `buildTree` turns entries into a sorted tree (+ filter).
- `src/components/Sidebar.svelte` — Files view: top-level folders via `TreeNode`, then top-level files in date groups (`bucket`, `groups`, `groupOpen`). `rows` = visible order for keyboard nav + shift-click.
- `src/components/TreeNode.svelte` — one row (and its children).
