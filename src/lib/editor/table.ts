// GFM pipe tables, Advanced Tables-style: Tab / Shift-Tab / Enter move between cells and re-align the table,
// and a toolbar above the table (while the cursor is in it) adds, moves, aligns and deletes rows and columns.
import { EditorSelection, StateField, type EditorState } from '@codemirror/state';
import { showTooltip, type Command, type EditorView, type KeyBinding, type Tooltip, type TooltipView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import TableToolbar from '../../components/TableToolbar.svelte';

export type Align = '' | 'left' | 'center' | 'right';

type Table = {
  from: number; // start of the header line
  to: number; // end of the last row line
  prefix: string; // indentation / blockquote markers, repeated on every line
  rows: string[][]; // trimmed cells; header first, delimiter row left out
  aligns: Align[];
  row: number; // cursor row (the delimiter row counts as the header)
  col: number;
  offset: number; // cursor offset inside the cell's text
};

const PIPE = /(?<!\\)\|/; // an escaped \| stays inside its cell
const PREFIX = /^[ \t]*(?:>[ \t]?)*/;
const DELIM_CELL = /^:?-+:?$/;
const CODE = new Set(['FencedCode', 'CodeBlock', 'HTMLBlock', 'CommentBlock']);

// ponytail: East Asian wide + emoji count as 2 columns, ZWJ sequences overcount; use a wcwidth table if that matters
const width = (s: string) =>
  [...s].reduce(
    (n, ch) =>
      n +
      (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3fffd}]|\p{Emoji_Presentation}/u.test(ch)
        ? 2
        : /[\p{M}‍️]/u.test(ch)
          ? 0
          : 1),
    0,
  );

/** [start, end) of each cell's raw text in a row line, between the pipes. */
function spans(text: string, from: number): [number, number][] {
  const out: [number, number][] = [];
  let i = from;
  while (text[i] === ' ' || text[i] === '\t') i++;
  if (text[i] === '|') i++;
  let start = i;
  for (; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === '|') (out.push([start, i]), (start = i + 1));
  }
  if (text.slice(start).trim()) out.push([start, text.length]);
  return out;
}

const cellsOf = (text: string) => spans(text, PREFIX.exec(text)![0].length).map(([a, b]) => text.slice(a, b).trim());
const isDelim = (text: string) => {
  const c = cellsOf(text);
  return c.length > 0 && c.every((x) => DELIM_CELL.test(x));
};
const alignOf = (d: string): Align => (d.startsWith(':') ? (d.endsWith(':') ? 'center' : 'left') : d.endsWith(':') ? 'right' : '');

function inCode(state: EditorState, pos: number) {
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) if (CODE.has(n.name)) return true;
  return false;
}

/**
 * The table around pos. GFM: the header is the line right above the first delimiter row (same cell count);
 * later delimiter-looking lines are body rows. Rows run while lines contain a pipe.
 */
function tableAt(state: EditorState, pos: number): Table | null {
  const doc = state.doc;
  const line = doc.lineAt(pos);
  if (!PIPE.test(line.text) || inCode(state, pos)) return null;
  let top = line.number, bottom = line.number;
  while (top > 1 && PIPE.test(doc.line(top - 1).text)) top--;
  while (bottom < doc.lines && PIPE.test(doc.line(bottom + 1).text)) bottom++;
  let d = 0;
  for (let n = top + 1; n <= bottom && !d; n++)
    if (isDelim(doc.line(n).text) && cellsOf(doc.line(n).text).length === cellsOf(doc.line(n - 1).text).length) d = n;
  if (!d || line.number < d - 1) return null;
  const head = doc.line(d - 1);
  const rows = [cellsOf(head.text)];
  const delim = cellsOf(doc.line(d).text);
  for (let n = d + 1; n <= bottom; n++) rows.push(cellsOf(doc.line(n).text));

  // where the cursor is: row, column, offset inside the cell text
  const sp = spans(line.text, PREFIX.exec(line.text)![0].length);
  const x = pos - line.from;
  let col = sp.findIndex(([, b]) => x <= b);
  if (col < 0) col = Math.max(0, sp.length - 1);
  let offset = 0;
  if (sp[col]) {
    const raw = line.text.slice(sp[col][0], sp[col][1]);
    const lead = raw.length - raw.trimStart().length;
    offset = Math.max(0, Math.min(raw.trim().length, x - sp[col][0] - lead));
  }
  return {
    from: head.from,
    to: doc.line(bottom).to,
    prefix: PREFIX.exec(head.text)![0],
    rows,
    aligns: delim.map(alignOf),
    row: line.number <= d ? 0 : line.number - d,
    col,
    offset,
  };
}

/** Aligned text for the table, plus where each cell's text starts (relative to the table start). */
function render(t: Pick<Table, 'prefix' | 'rows' | 'aligns'>) {
  const n = Math.max(1, t.aligns.length, ...t.rows.map((r) => r.length));
  const rows = t.rows.map((r) => Array.from({ length: n }, (_, c) => r[c] ?? ''));
  const al = Array.from({ length: n }, (_, c) => t.aligns[c] ?? '');
  const w = al.map((_, c) => Math.max(3, ...rows.map((r) => width(r[c]))));
  const at: number[][] = [];
  let text = '';
  const line = (cells: string[], r: number | null) => {
    if (text) text += '\n';
    text += t.prefix + '|';
    const starts: number[] = [];
    cells.forEach((s, c) => {
      const gap = w[c] - width(s);
      const lead = r === null ? 0 : al[c] === 'right' ? gap : al[c] === 'center' ? gap >> 1 : 0;
      starts.push(text.length + 1 + lead);
      text += ' ' + ' '.repeat(lead) + s + ' '.repeat(gap - lead) + ' |';
    });
    if (r !== null) at[r] = starts;
  };
  const dash = (a: Align, k: number) =>
    a === 'center' ? ':' + '-'.repeat(k - 2) + ':' : a === 'left' ? ':' + '-'.repeat(k - 1) : a === 'right' ? '-'.repeat(k - 1) + ':' : '-'.repeat(k);
  line(rows[0], 0);
  line(al.map((a, c) => dash(a, w[c])), null);
  rows.slice(1).forEach((r, i) => line(r, i + 1));
  return { text, at: (r: number, c: number) => at[Math.min(r, at.length - 1)][Math.min(c, n - 1)] };
}

type Edit = { rows: string[][]; aligns: Align[]; row: number; col: number; select?: boolean; offset?: number };

/** One dispatch per action (re-align + move), so a single undo reverts it. */
function apply(view: EditorView, t: Table, e: Edit) {
  const out = render({ prefix: t.prefix, rows: e.rows, aligns: e.aligns });
  const start = t.from + out.at(e.row, e.col);
  const len = (e.rows[e.row]?.[e.col] ?? '').length;
  const changed = out.text !== view.state.sliceDoc(t.from, t.to);
  view.dispatch({
    changes: changed ? { from: t.from, to: t.to, insert: out.text } : undefined,
    selection: e.select ? EditorSelection.range(start, start + len) : EditorSelection.cursor(start + Math.min(e.offset ?? len, len)),
    scrollIntoView: true,
    userEvent: 'input',
  });
  return true;
}

/** Run fn on the table under a single cursor; false (fall through to the default key) elsewhere. */
const onTable =
  (fn: (t: Table, view: EditorView) => Edit | boolean): Command =>
  (view) => {
    if (view.state.selection.ranges.length > 1) return false;
    const t = tableAt(view.state, view.state.selection.main.head);
    if (!t) return false;
    const e = fn(t, view);
    return typeof e === 'boolean' ? e : apply(view, t, e);
  };

const width0 = (t: Table) => Math.max(t.aligns.length, ...t.rows.map((r) => r.length));
const blankRow = (t: Table) => Array<string>(width0(t)).fill('');
const keep = (t: Table, rows = t.rows, aligns = t.aligns): Edit => ({ rows, aligns, row: t.row, col: t.col, offset: t.offset });

// Excel-style return: after Tabbing along a row, Enter goes down to the column the Tab run started in
const tabStart = new WeakMap<EditorView, { from: number; row: number; col: number }>();

const nextCell = onTable((t, view) => {
  const n = width0(t);
  if (t.col + 1 < n) {
    const a = tabStart.get(view);
    if (!a || a.from !== t.from || a.row !== t.row) tabStart.set(view, { from: t.from, row: t.row, col: t.col });
    return { ...keep(t), col: t.col + 1, select: true };
  }
  tabStart.delete(view);
  const rows = t.row + 1 < t.rows.length ? t.rows : [...t.rows, blankRow(t)];
  return { rows, aligns: t.aligns, row: t.row + 1, col: 0, select: true };
});

const prevCell = onTable((t) => {
  if (t.col > 0) return { ...keep(t), col: t.col - 1, select: true };
  if (t.row > 0) return { ...keep(t), row: t.row - 1, col: width0(t) - 1, select: true };
  return { ...keep(t), select: true };
});

const nextRow = onTable((t, view) => {
  const last = t.row === t.rows.length - 1;
  // Enter on an empty last row leaves the table (a blank line keeps the next paragraph out of it)
  if (last && t.row > 0 && t.rows[t.row].every((c) => !c)) {
    const out = render({ prefix: t.prefix, rows: t.rows.slice(0, -1), aligns: t.aligns });
    view.dispatch({
      changes: { from: t.from, to: t.to, insert: out.text + '\n\n' },
      selection: { anchor: t.from + out.text.length + 2 },
      scrollIntoView: true,
      userEvent: 'input',
    });
    return true;
  }
  const a = tabStart.get(view);
  tabStart.delete(view);
  const rows = last ? [...t.rows, blankRow(t)] : t.rows;
  return { rows, aligns: t.aligns, row: t.row + 1, col: a && a.from === t.from && a.row === t.row ? a.col : t.col, select: true };
});

/** `| a | b |` + Enter outside a table: add the delimiter row and a first body row. */
const createTable: Command = (view) => {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty || state.selection.ranges.length > 1) return false;
  const line = state.doc.lineAt(sel.head);
  const prefix = PREFIX.exec(line.text)![0];
  const body = line.text.slice(prefix.length).trimEnd();
  if (!/^\|.*(?<!\\)\|$/.test(body) || sel.head < line.from + prefix.length + body.length) return false;
  if (inCode(state, sel.head)) return false;
  const head = cellsOf(line.text);
  if (!head.some(Boolean)) return false;
  const t: Table = { from: line.from, to: line.to, prefix, rows: [head], aligns: head.map(() => ''), row: 0, col: 0, offset: 0 };
  return apply(view, t, { rows: [head, blankRow(t)], aligns: t.aligns, row: 1, col: 0 });
};

const swap = <T>(a: T[], i: number, j: number) => ((a = [...a]), ([a[i], a[j]] = [a[j], a[i]]), a);
const insertAt = <T>(a: T[], i: number, v: T) => [...a.slice(0, i), v, ...a.slice(i)];
const removeAt = <T>(a: T[], i: number) => [...a.slice(0, i), ...a.slice(i + 1)];
const padRow = (t: Table, r: string[]) => Array.from({ length: width0(t) }, (_, c) => r[c] ?? '');
const align = (a: Align) =>
  onTable((t) => {
    const aligns = Array.from({ length: width0(t) }, (_, c) => t.aligns[c] ?? '');
    aligns[t.col] = aligns[t.col] === a ? '' : a; // clicking the active alignment resets it
    return keep(t, t.rows, aligns);
  });
const colEdit = (fn: (r: string[], t: Table) => string[], afn: (a: Align[], t: Table) => Align[], col: (t: Table) => number) =>
  onTable((t) => ({ ...keep(t, t.rows.map((r) => fn(padRow(t, r), t)), afn(padRow(t, t.aligns) as Align[], t)), col: col(t), offset: 0 }));

export const tableCommands = {
  format: onTable((t) => keep(t)),
  alignLeft: align('left'),
  alignCenter: align('center'),
  alignRight: align('right'),
  rowAbove: onTable((t) => t.row > 0 && { ...keep(t, insertAt(t.rows, t.row, blankRow(t))), offset: 0 }),
  rowBelow: onTable((t) => ({ ...keep(t, insertAt(t.rows, t.row + 1, blankRow(t))), row: t.row + 1, offset: 0 })),
  rowUp: onTable((t) => t.row > 1 && { ...keep(t, swap(t.rows, t.row, t.row - 1)), row: t.row - 1 }),
  rowDown: onTable((t) => t.row > 0 && t.row < t.rows.length - 1 && { ...keep(t, swap(t.rows, t.row, t.row + 1)), row: t.row + 1 }),
  deleteRow: onTable((t) => t.row > 0 && { ...keep(t, removeAt(t.rows, t.row)), row: Math.min(t.row, t.rows.length - 2), offset: 0 }),
  colLeft: colEdit((r, t) => insertAt(r, t.col, ''), (a, t) => insertAt(a, t.col, ''), (t) => t.col),
  colRight: colEdit((r, t) => insertAt(r, t.col + 1, ''), (a, t) => insertAt(a, t.col + 1, ''), (t) => t.col + 1),
  colMoveLeft: onTable((t) => t.col > 0 && { ...keep(t, t.rows.map((r) => swap(padRow(t, r), t.col, t.col - 1)), swap(padRow(t, t.aligns) as Align[], t.col, t.col - 1)), col: t.col - 1 }),
  colMoveRight: onTable(
    (t) => t.col < width0(t) - 1 && { ...keep(t, t.rows.map((r) => swap(padRow(t, r), t.col, t.col + 1)), swap(padRow(t, t.aligns) as Align[], t.col, t.col + 1)), col: t.col + 1 },
  ),
  deleteCol: onTable(
    (t) => width0(t) > 1 && { ...keep(t, t.rows.map((r) => removeAt(padRow(t, r), t.col)), removeAt(padRow(t, t.aligns) as Align[], t.col)), col: Math.min(t.col, width0(t) - 2), offset: 0 },
  ),
} satisfies Record<string, Command>;

export type TableAction = keyof typeof tableCommands;

/** Part of smart typing: Plain mode leaves Tab and Enter alone. */
export const tableKeymap: KeyBinding[] = [
  { key: 'Tab', run: nextCell, shift: prevCell },
  { key: 'Enter', run: (v) => nextRow(v) || createTable(v) },
];

// ---- toolbar ----
export type TableInfo = { align: Align; row: number; col: number; rows: number; cols: number };
const infoOf = (t: Table): TableInfo => ({ align: t.aligns[t.col] ?? '', row: t.row, col: t.col, rows: t.rows.length, cols: width0(t) });

function createToolbar(view: EditorView): TooltipView {
  const dom = document.createElement('div');
  dom.className = 'cm-table-tip';
  const t = tableAt(view.state, view.state.selection.main.head);
  const info = writable<TableInfo>(t ? infoOf(t) : { align: '', row: 0, col: 0, rows: 1, cols: 1 });
  const run = (a: TableAction) => (tableCommands[a](view), view.focus());
  const comp = mount(TableToolbar, { target: dom, props: { info, run } });
  return {
    dom,
    offset: { x: -4, y: 0 },
    update(u) {
      if (!u.docChanged && !u.selectionSet) return;
      const t = tableAt(u.state, u.state.selection.main.head);
      if (t) info.set(infoOf(t));
    },
    destroy: () => void unmount(comp),
  };
}

/** Sits in the blank line above the table (or below it) so it never covers text. */
function toolbarFor(state: EditorState): Tooltip | null {
  if (state.selection.ranges.length > 1) return null;
  const t = tableAt(state, state.selection.main.head);
  if (!t) return null;
  const blank = (n: number) => n >= 1 && n <= state.doc.lines && !state.doc.line(n).text.trim();
  const first = state.doc.lineAt(t.from).number, last = state.doc.lineAt(t.to);
  const above = blank(first - 1) || !blank(last.number + 1);
  return { pos: (above ? t.from : last.from) + t.prefix.length, above, arrow: false, create: createToolbar };
}

/** Not part of smart typing: the toolbar only acts when clicked, so it stays on in Plain mode. */
export const tableToolbar = StateField.define<Tooltip | null>({
  create: toolbarFor,
  update: (v, tr) => (tr.docChanged || tr.selection ? toolbarFor(tr.state) : v),
  provide: (f) => showTooltip.from(f),
});
