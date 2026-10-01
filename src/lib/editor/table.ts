// GFM pipe tables, Advanced Tables-style: Tab / Shift-Tab / Enter move between cells and re-align the table,
// and a toolbar above the table (while the cursor is in it) adds, moves, aligns and deletes rows and columns.
import { EditorSelection, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import { showTooltip, type Command, type EditorView, type KeyBinding, type Rect, type Tooltip, type TooltipView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { isolateHistory } from '@codemirror/commands';
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
// quote markers + indentation, repeated on every line (">   " keeps a list indent inside a quote)
const PREFIX = /^(?:[ \t]*>)*[ \t]*/;
const DELIM_CELL = /^:?-+:?$/;
const CODE = new Set(['FencedCode', 'CodeBlock', 'HTMLBlock', 'CommentBlock']);
// a line that opens another block (heading, list item) ends the table, as in comrak
const BLOCK = /^ {0,3}(?:#{1,6}(?:\s|$)|[-+*]\s|\d{1,9}[.)]\s)/;

const prefixOf = (t: string) => PREFIX.exec(t)![0];
const depth = (t: string) => (prefixOf(t).match(/>/g) ?? []).length;
/** Could be a row of a table whose lines sit at quote depth q. */
const rowLike = (t: string, q: number) => PIPE.test(t) && depth(t) === q && !BLOCK.test(t.slice(prefixOf(t).length));

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
  // like comrak: a run of pipes stays in the cell when escaped or of even length (||spoiler||), else its last pipe ends it
  for (; i < text.length; i++) {
    if (text[i] !== '|') continue;
    let k = 1;
    while (text[i + k] === '|') k++;
    if (text[i - 1] !== '\\' && k % 2) out.push([start, i + k - 1]), (start = i + k);
    i += k - 1;
  }
  if (text.slice(start).trim()) out.push([start, text.length]);
  return out;
}

const cellsOf = (text: string) => spans(text, prefixOf(text).length).map(([a, b]) => text.slice(a, b).trim());
const isDelim = (text: string) => {
  const c = cellsOf(text);
  return c.length > 0 && c.every((x) => DELIM_CELL.test(x));
};
const alignOf = (d: string): Align => (d.startsWith(':') ? (d.endsWith(':') ? 'center' : 'left') : d.endsWith(':') ? 'right' : '');

/** Code, HTML or $$ math: never a table. Also true where a huge doc isn't parsed yet (fail closed). */
function inCode(state: EditorState, pos: number) {
  const tree = syntaxTree(state);
  if (tree.length < pos) return true;
  for (let n: SyntaxNode | null = tree.resolveInner(pos, -1); n; n = n.parent) if (CODE.has(n.name)) return true;
  // comrak's $$ math can't cross a blank line: an odd $$ count since the paragraph start = inside math
  // ponytail: a $$ inside a code span counts too
  const doc = state.doc;
  let n = doc.lineAt(pos).number;
  while (n > 1 && doc.line(n - 1).text.trim()) n--;
  return (state.sliceDoc(doc.line(n).from, pos).match(/\$\$/g) ?? []).length % 2 === 1;
}

/**
 * The table around pos. Rows run while lines have a pipe, stay at the same quote depth and don't open another block.
 * GFM: the header is the line right above the first delimiter row; later delimiter-looking lines are body rows.
 * The header and delimiter may disagree on cell count while you add or remove a column: re-align repairs it.
 */
function tableAt(state: EditorState, pos: number): Table | null {
  const doc = state.doc;
  const line = doc.lineAt(pos);
  const q = depth(line.text);
  if (!rowLike(line.text, q) || inCode(state, pos)) return null;
  let top = line.number, bottom = line.number;
  while (top > 1 && rowLike(doc.line(top - 1).text, q)) top--;
  while (bottom < doc.lines && rowLike(doc.line(bottom + 1).text, q)) bottom++;
  let d = 0;
  for (let n = top + 1; n <= bottom && !d; n++) if (isDelim(doc.line(n).text)) d = n;
  if (!d || line.number < d - 1) return null;
  const head = doc.line(d - 1);
  const rows = [cellsOf(head.text)];
  const delim = cellsOf(doc.line(d).text);
  for (let n = d + 1; n <= bottom; n++) rows.push(cellsOf(doc.line(n).text));

  // where the cursor is: row, column, offset inside the cell text
  const sp = spans(line.text, prefixOf(line.text).length);
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
    prefix: prefixOf(head.text),
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

type Edit = {
  rows: string[][];
  aligns: Align[];
  row: number;
  col: number;
  select?: boolean;
  offset?: number;
  effects?: StateEffect<unknown>[];
  tail?: string; // text right after the table (createTable's blank line)
};

/** One dispatch per action (re-align + move), its own undo step: typing right after it doesn't merge in. */
function apply(view: EditorView, t: Table, e: Edit) {
  const out = render({ prefix: t.prefix, rows: e.rows, aligns: e.aligns });
  const start = t.from + out.at(e.row, e.col);
  const len = (e.rows[e.row]?.[e.col] ?? '').length;
  const text = out.text + (e.tail ?? '');
  const changed = text !== view.state.sliceDoc(t.from, t.to);
  view.dispatch({
    changes: changed ? { from: t.from, to: t.to, insert: text } : undefined,
    selection: e.select ? EditorSelection.range(start, start + len) : EditorSelection.cursor(start + Math.min(e.offset ?? len, len)),
    effects: e.effects,
    annotations: isolateHistory.of('full'),
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

// Excel-style return: after Tabbing along a row, Enter goes down to the column the Tab run started in.
// Lives in the EditorState (one per file); a click or arrow key ends the run.
type Run = { from: number; row: number; start: number; landed: number };
const setRun = StateEffect.define<Run | null>();
const tabRun = StateField.define<Run | null>({
  create: () => null,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setRun)) return e.value;
    if (!v || tr.isUserEvent('select') || tr.isUserEvent('undo') || tr.isUserEvent('redo')) return null;
    return tr.docChanged ? { ...v, from: tr.changes.mapPos(v.from) } : v;
  },
});
/** The run still matches: same table + row, and the cursor is where the last Tab put it. */
const runOf = (t: Table, view: EditorView) => {
  const r = view.state.field(tabRun, false);
  return r && r.from === t.from && r.row === t.row && r.landed === t.col ? r : null;
};

const nextCell = onTable((t, view) => {
  const n = width0(t);
  if (t.col + 1 < n) {
    const start = runOf(t, view)?.start ?? t.col;
    return { ...keep(t), col: t.col + 1, select: true, effects: [setRun.of({ from: t.from, row: t.row, start, landed: t.col + 1 })] };
  }
  const rows = t.row + 1 < t.rows.length ? t.rows : [...t.rows, blankRow(t)];
  return { rows, aligns: t.aligns, row: t.row + 1, col: 0, select: true, effects: [setRun.of(null)] };
});

const prevCell = onTable((t, view) => {
  const r = runOf(t, view);
  if (t.col > 0) return { ...keep(t), col: t.col - 1, select: true, effects: [setRun.of(r && { ...r, landed: t.col - 1 })] };
  if (t.row > 0) return { ...keep(t), row: t.row - 1, col: width0(t) - 1, select: true, effects: [setRun.of(null)] };
  return { ...keep(t), select: true };
});

const nextRow = onTable((t, view) => {
  const last = t.row === t.rows.length - 1;
  // Enter on an empty last row leaves the table, still inside its quote/list (prefix kept); the blank line keeps
  // the next paragraph out of the table
  if (last && t.row > 0 && t.rows[t.row].every((c) => !c)) {
    const out = render({ prefix: t.prefix, rows: t.rows.slice(0, -1), aligns: t.aligns });
    const sep = '\n' + t.prefix.trimEnd() + '\n' + t.prefix;
    view.dispatch({
      changes: { from: t.from, to: t.to, insert: out.text + sep },
      selection: { anchor: t.from + out.text.length + sep.length },
      effects: setRun.of(null),
      annotations: isolateHistory.of('full'),
      scrollIntoView: true,
      userEvent: 'input',
    });
    return true;
  }
  const col = runOf(t, view)?.start ?? t.col;
  const rows = last ? [...t.rows, blankRow(t)] : t.rows;
  return { rows, aligns: t.aligns, row: t.row + 1, col, select: true, effects: [setRun.of(null)] };
});

/** `| a | b |` + Enter outside a table: add the delimiter row and a first body row. */
const createTable: Command = (view) => {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty || state.selection.ranges.length > 1) return false;
  const doc = state.doc;
  const line = doc.lineAt(sel.head);
  const prefix = prefixOf(line.text);
  const body = line.text.slice(prefix.length).trimEnd();
  if (!/^\|.*(?<!\\)\|$/.test(body) || sel.head < line.from + prefix.length + body.length) return false;
  // not a ||spoiler|| line, a stray delimiter row, a header whose delimiter is already below, code or math
  const next = line.number < doc.lines ? doc.line(line.number + 1) : null;
  if ((body.startsWith('||') && body.endsWith('||')) || isDelim(line.text) || (next && isDelim(next.text))) return false;
  if (inCode(state, sel.head)) return false;
  const head = cellsOf(line.text);
  if (!head.some(Boolean)) return false;
  const t: Table = { from: line.from, to: line.to, prefix, rows: [head], aligns: head.map(() => ''), row: 0, col: 0, offset: 0 };
  // a paragraph right below would be swallowed as a row (GFM): keep a blank line between
  const tail = next && !PIPE.test(next.text) && next.text.slice(prefixOf(next.text).length).trim() ? '\n' + prefix.trimEnd() : '';
  return apply(view, t, { rows: [head, blankRow(t)], aligns: t.aligns, row: 1, col: 0, tail });
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

// a selection across lines keeps Tab = indent and Enter = replace, even when it ends in a table
const oneLine =
  (c: Command): Command =>
  (v) => {
    const { anchor, head } = v.state.selection.main;
    return v.state.doc.lineAt(anchor).number === v.state.doc.lineAt(head).number && c(v);
  };

/** Part of smart typing: Plain mode leaves Tab and Enter alone. */
export const tableKeymap: KeyBinding[] = [
  { key: 'Tab', run: oneLine(nextCell), shift: oneLine(prevCell) },
  { key: 'Enter', run: (v) => oneLine(nextRow)(v) || createTable(v) },
];

// ---- toolbar ----
export type TableInfo = { align: Align; row: number; col: number; rows: number; cols: number };
const infoOf = (t: Table): TableInfo => ({ align: t.aligns[t.col] ?? '', row: t.row, col: t.col, rows: t.rows.length, cols: width0(t) });

function createToolbar(view: EditorView, above: boolean): TooltipView {
  const dom = document.createElement('div');
  dom.className = 'cm-table-tip';
  const t = tableAt(view.state, view.state.selection.main.head);
  const info = writable<TableInfo>(t ? infoOf(t) : { align: '', row: 0, col: 0, rows: 1, cols: 1 });
  const run = (a: TableAction) => (tableCommands[a](view), view.focus());
  const comp = mount(TableToolbar, { target: dom, props: { info, run } });
  return {
    dom,
    offset: { x: -4, y: 0 },
    // below the table: under the last row's last visual line (rows wrap, nearly always on phones)
    getCoords: above
      ? undefined
      : (p) => {
          const a = view.coordsAtPos(p);
          if (!a) return null as unknown as Rect; // anchor not rendered: CM hides the tooltip
          const b = view.coordsAtPos(view.state.doc.lineAt(p).to, -1) ?? a;
          return { left: a.left, right: a.right, top: a.top, bottom: b.bottom };
        },
    // never over the tab bar or the search panel: hidden while its spot is outside the editor's scroller
    positioned() {
      const r = dom.getBoundingClientRect(), s = view.scrollDOM.getBoundingClientRect();
      dom.style.visibility = r.top < s.top || r.bottom > s.bottom ? 'hidden' : '';
    },
    update(u) {
      if (!u.docChanged && !u.selectionSet) return;
      const t = tableAt(u.state, u.state.selection.main.head);
      if (t) info.set(infoOf(t));
    },
    destroy: () => void unmount(comp),
  };
}

// one create per side, so switching sides builds a fresh tooltip instead of keeping the old placement
const createAbove = (v: EditorView) => createToolbar(v, true);
const createBelow = (v: EditorView) => createToolbar(v, false);

/** Sits in the blank line above the table (or below it) so it never covers text. */
function toolbarFor(state: EditorState): Tooltip | null {
  if (state.selection.ranges.length > 1) return null;
  const t = tableAt(state, state.selection.main.head);
  if (!t) return null;
  const doc = state.doc;
  // blank: nothing but the quote prefix, or past the end of the document
  const blank = (n: number) => n > doc.lines || (n >= 1 && !doc.line(n).text.replace(PREFIX, '').trim());
  const first = doc.lineAt(t.from).number, last = doc.lineAt(t.to);
  const above = blank(first - 1) || !blank(last.number + 1);
  return { pos: (above ? t.from : last.from) + t.prefix.length, above, arrow: false, create: above ? createAbove : createBelow };
}

/** Not part of smart typing: the toolbar only acts when clicked, so it stays on in Plain mode. */
export const tableToolbar: Extension = [
  tabRun,
  StateField.define<Tooltip | null>({
    create: toolbarFor,
    update: (v, tr) => (tr.docChanged || tr.selection ? toolbarFor(tr.state) : v),
    provide: (f) => showTooltip.from(f),
  }),
];
