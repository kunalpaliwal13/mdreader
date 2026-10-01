// "Smart" typing helpers. They all live in one compartment so the Plain toggle can switch them off together.
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

// no quotes: apostrophes are prose, pairing them gets in the way of writing
const pairs = { brackets: ['(', '[', '{', '`'] };
const WRAP = '*_~=`';

/** Typing * _ ~ = ` with text selected wraps the selection instead of replacing it (Obsidian-style). */
const wrapSelection = EditorView.inputHandler.of((view, _from, _to, text) => {
  if (text.length !== 1 || !WRAP.includes(text)) return false;
  if (view.state.selection.ranges.every((r) => r.empty)) return false;
  view.dispatch(
    view.state.changeByRange((r) =>
      r.empty
        ? { changes: { from: r.from, insert: text }, range: EditorSelection.cursor(r.from + 1) }
        : {
            changes: [{ from: r.from, insert: text }, { from: r.to, insert: text }],
            range: EditorSelection.range(r.from + 1, r.to + 1),
          },
    ),
    { userEvent: 'input.type' },
  );
  return true;
});

export function smartTyping(extra: Extension[] = []): Extension[] {
  return [EditorState.languageData.of(() => [{ closeBrackets: pairs }]), closeBrackets(), keymap.of(closeBracketsKeymap), wrapSelection, ...extra];
}
