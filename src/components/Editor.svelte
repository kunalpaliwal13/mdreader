<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorState, EditorSelection, type Extension } from '@codemirror/state';
  import { EditorView, keymap, drawSelection, dropCursor, highlightActiveLine, placeholder, type Command } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
  import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
  import { tags as t } from '@lezer/highlight';
  import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
  import { isMarkdown, basename, dirname } from '../lib/fs';
  import { app, editorStates } from '../lib/app.svelte';

  let { path }: { path: string } = $props();
  let host: HTMLDivElement;
  let view: EditorView;
  let current = '';

  // ---- formatting commands ----
  const wrap = (mark: string): Command => (v) => {
    v.dispatch(
      v.state.changeByRange((r) => {
        const text = v.state.sliceDoc(r.from, r.to);
        const before = v.state.sliceDoc(r.from - mark.length, r.from);
        const after = v.state.sliceDoc(r.to, r.to + mark.length);
        // toggle off when already wrapped
        if (before === mark && after === mark)
          return {
            changes: [{ from: r.from - mark.length, to: r.from }, { from: r.to, to: r.to + mark.length }],
            range: EditorSelection.range(r.from - mark.length, r.to - mark.length),
          };
        return {
          changes: { from: r.from, to: r.to, insert: mark + text + mark },
          range: EditorSelection.range(r.from + mark.length, r.to + mark.length),
        };
      }),
    );
    return true;
  };

  const link: Command = (v) => {
    v.dispatch(
      v.state.changeByRange((r) => {
        const text = v.state.sliceDoc(r.from, r.to) || 'text';
        const insert = `[${text}](url)`;
        const urlStart = r.from + text.length + 3;
        return { changes: { from: r.from, to: r.to, insert }, range: EditorSelection.range(urlStart, urlStart + 3) };
      }),
    );
    return true;
  };

  // Enter on an empty list/task item leaves the list instead of continuing it
  const exitEmptyItem: Command = (v) => {
    const sel = v.state.selection.main;
    if (!sel.empty) return false;
    const line = v.state.doc.lineAt(sel.head);
    if (sel.head !== line.to || !/^\s*([-*+]|\d+[.)])( \[[ xX]\])?\s*$/.test(line.text)) return false;
    v.dispatch({ changes: { from: line.from, to: line.to, insert: '' } });
    return true;
  };

  // [[ -> workspace file names
  function wikiComplete(ctx: CompletionContext) {
    const m = ctx.matchBefore(/\[\[[^\]|\n]*$/);
    if (!m) return null;
    const options = app.entries
      .filter((e) => e.kind === 'file' && isMarkdown(e.path) && e.path !== current)
      .map((e) => {
        const label = basename(e.path).replace(/\.(md|markdown|mdx|txt)$/i, '');
        return { label, detail: dirname(e.path), type: 'text', apply: label + ']]' };
      });
    return { from: m.from + 2, options, validFor: /^[^\]|\n]*$/ };
  }

  const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s.trim());

  function insertAtCursor(v: EditorView, text: string, pos?: number) {
    const at = pos ?? v.state.selection.main.from;
    const to = pos ?? v.state.selection.main.to;
    v.dispatch({ changes: { from: at, to, insert: text }, selection: { anchor: at + text.length } });
  }

  async function saveImages(v: EditorView, files: File[], pos?: number) {
    const docPath = path;
    const links: string[] = [];
    for (const f of files) {
      const rel = await app.saveAsset(docPath, f);
      if (rel) links.push(`![${f.name.replace(/\.[^.]+$/, '') || 'image'}](${rel})`);
    }
    if (links.length && docPath === path) insertAtCursor(v, links.join('\n'), pos);
  }

  const handlers = EditorView.domEventHandlers({
    paste(e, v) {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        saveImages(v, files);
        return true;
      }
      // pasting a URL over selected text makes a link
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const sel = v.state.selection.main;
      if (!sel.empty && isUrl(text)) {
        e.preventDefault();
        const label = v.state.sliceDoc(sel.from, sel.to);
        insertAtCursor(v, `[${label}](${text.trim()})`);
        return true;
      }
      return false;
    },
    drop(e, v) {
      const all = [...(e.dataTransfer?.files ?? [])];
      if (!all.length) return false;
      const images = all.filter((f) => f.type.startsWith('image/'));
      // non-image files: skip CodeMirror's "insert file text" and let the workspace importer take them
      if (!images.length) return true;
      e.preventDefault();
      e.stopPropagation();
      const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? undefined;
      saveImages(v, images, pos);
      return true;
    },
  });

  const highlight = HighlightStyle.define([
    { tag: t.heading1, fontSize: '1.3em', fontWeight: '650' },
    { tag: t.heading2, fontSize: '1.15em', fontWeight: '650' },
    { tag: [t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '650' },
    { tag: t.strong, fontWeight: '650' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: [t.link, t.url], color: 'var(--cm-link)' },
    { tag: [t.processingInstruction, t.contentSeparator, t.meta], color: 'var(--text-faint)' },
    { tag: t.monospace, color: 'var(--cm-code)' },
    { tag: t.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
    { tag: t.list, color: 'var(--accent)' },
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword], color: 'var(--cm-keyword)' },
    { tag: [t.string, t.special(t.string)], color: 'var(--cm-string)' },
    { tag: [t.number, t.bool, t.atom], color: 'var(--cm-number)' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--text-faint)', fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.typeName, t.className], color: 'var(--cm-title)' },
    { tag: [t.propertyName, t.attributeName], color: 'var(--cm-attr)' },
  ]);

  const theme = EditorView.theme({
    '&': { height: '100%', fontSize: '14px', backgroundColor: 'var(--bg)', color: 'var(--text)' },
    '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.7', overflow: 'auto' },
    '.cm-content': { padding: '40px 0 50vh', maxWidth: '760px', margin: '0 auto', caretColor: 'var(--accent)' },
    '.cm-line': { padding: '0 32px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--bg-hover) 60%, transparent)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent) !important',
    },
    '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)' },
    '.cm-placeholder': { color: 'var(--text-faint)' },
    '.cm-panels': { backgroundColor: 'var(--bg-subtle)', color: 'var(--text)', borderColor: 'var(--border)' },
    '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
    '.cm-search': { fontFamily: 'var(--font)', fontSize: '12px', padding: '6px 10px' },
    '.cm-search input, .cm-search button': { fontFamily: 'var(--font)', borderRadius: '5px' },
    '.cm-textfield': { border: '1px solid var(--border-strong)', background: 'var(--bg)', padding: '3px 6px' },
    '.cm-button': { backgroundImage: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '3px 8px' },
    '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, #facc15 35%, transparent)' },
    '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, #f97316 45%, transparent)' },
    '.cm-matchingBracket': { backgroundColor: 'var(--bg-active)', outline: 'none' },
    '.cm-tooltip': { border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', boxShadow: 'var(--shadow)', overflow: 'hidden' },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font)', fontSize: '13px', maxHeight: '240px' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px !important' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--text)' },
    '.cm-completionDetail': { color: 'var(--text-faint)', fontStyle: 'normal', marginLeft: '8px' },
  });

  const extensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false }),
    syntaxHighlighting(highlight),
    placeholder('Start writing…'),
    autocompletion({ override: [wikiComplete], icons: false }),
    theme,
    handlers,
    keymap.of([
      { key: 'Enter', run: (v) => exitEmptyItem(v) || insertNewlineContinueMarkup(v) },
      { key: 'Backspace', run: deleteMarkupBackward },
      { key: 'Mod-b', run: wrap('**') },
      { key: 'Mod-i', run: wrap('*') },
      { key: 'Mod-k', run: link },
      { key: 'Mod-Shift-x', run: wrap('~~') },
      ...searchKeymap,
      ...historyKeymap,
      ...defaultKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) app.setText(current, u.state.doc.toString());
      if (u.selectionSet || u.docChanged) {
        const head = u.state.selection.main.head;
        const line = u.state.doc.lineAt(head);
        app.cursor = { line: line.number, col: head - line.from + 1 };
      }
    }),
  ];

  const stateFor = (p: string) =>
    editorStates.get(p) ?? EditorState.create({ doc: app.texts[p] ?? '', extensions });

  const keep = () => {
    if (current && current in app.texts) editorStates.set(current, view.state);
  };

  function show(p: string) {
    keep();
    current = p;
    const s = stateFor(p);
    view.setState(s);
    const head = s.selection.main.head;
    const line = s.doc.lineAt(head);
    app.cursor = { line: line.number, col: head - line.from + 1 };
  }

  // ---- scroll sync + jump to line ----
  let ignoreUntil = 0;
  function topLine(): number {
    const pad = view.documentPadding.top;
    const y = Math.max(0, view.scrollDOM.scrollTop - pad);
    const block = view.lineBlockAtHeight(y);
    const line = view.state.doc.lineAt(block.from).number;
    return line + Math.min(1, Math.max(0, (y - block.top) / Math.max(1, block.height)));
  }
  function scrollToLine(l: number) {
    const doc = view.state.doc;
    const n = Math.min(doc.lines, Math.max(1, Math.floor(l)));
    const block = view.lineBlockAt(doc.line(n).from);
    ignoreUntil = performance.now() + 120;
    view.scrollDOM.scrollTop = block.top + (l - n) * block.height + view.documentPadding.top;
  }
  function onScroll() {
    if (performance.now() < ignoreUntil || app.mode !== 'split') return;
    app.scrollPreviewTo?.(topLine());
  }

  onMount(() => {
    // renames/moves keep the live view; just follow the new path
    app.onRemap = (map) => (current = map(current));
    app.editHook = (p, from, to, insert) => {
      if (p !== current) return false;
      view.dispatch({ changes: { from, to, insert } });
      return true;
    };
    current = path;
    view = new EditorView({ state: stateFor(path), parent: host });
    view.scrollDOM.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
    app.scrollEditorTo = scrollToLine;
    app.focusEditorLine = (l) => {
      const line = view.state.doc.line(Math.min(view.state.doc.lines, Math.max(1, l)));
      view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 60 }) });
      view.focus();
    };
    if (!app.narrow) view.focus();
  });

  $effect(() => {
    if (view && path !== current) show(path);
  });

  onDestroy(() => {
    if (view) keep();
    app.onRemap = null;
    app.editHook = null;
    app.scrollEditorTo = null;
    app.focusEditorLine = null;
    view?.destroy();
  });
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    height: 100%;
    min-height: 0;
    --cm-link: var(--accent);
    --cm-code: #b4235a;
    --cm-keyword: #cf222e;
    --cm-string: #0a3069;
    --cm-number: #0550ae;
    --cm-title: #8250df;
    --cm-attr: #953800;
  }
  :global([data-theme='dark']) .editor {
    --cm-code: #f0a1c2;
    --cm-keyword: #ff7b72;
    --cm-string: #a5d6ff;
    --cm-number: #79c0ff;
    --cm-title: #d2a8ff;
    --cm-attr: #ffa657;
  }
</style>
