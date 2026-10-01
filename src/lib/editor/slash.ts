// "/" at the start of a line (or after a space) opens a block menu. Part of smart typing, so Plain turns it off.
import { snippet, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { app } from '../app.svelte';
import { basename } from '../fs';
import { templateFiles, fill, localDate as today, localTime as now } from '../templates';

type Item = { label: string; detail: string; section: string; tpl: string | (() => string) };

const ITEMS: Item[] = [
  { label: 'Heading 1', detail: '#', section: 'Text', tpl: '# ${}' },
  { label: 'Heading 2', detail: '##', section: 'Text', tpl: '## ${}' },
  { label: 'Heading 3', detail: '###', section: 'Text', tpl: '### ${}' },
  { label: 'Bullet list', detail: '-', section: 'Text', tpl: '- ${}' },
  { label: 'Numbered list', detail: '1.', section: 'Text', tpl: '1. ${}' },
  { label: 'Task list', detail: '- [ ]', section: 'Text', tpl: '- [ ] ${}' },
  { label: 'Quote', detail: '>', section: 'Text', tpl: '> ${}' },
  { label: 'Note callout', detail: '> [!NOTE]', section: 'Callouts', tpl: '> [!NOTE]\n> ${}' },
  { label: 'Tip callout', detail: '> [!TIP]', section: 'Callouts', tpl: '> [!TIP]\n> ${}' },
  { label: 'Important callout', detail: '> [!IMPORTANT]', section: 'Callouts', tpl: '> [!IMPORTANT]\n> ${}' },
  { label: 'Warning callout', detail: '> [!WARNING]', section: 'Callouts', tpl: '> [!WARNING]\n> ${}' },
  { label: 'Caution callout', detail: '> [!CAUTION]', section: 'Callouts', tpl: '> [!CAUTION]\n> ${}' },
  { label: 'Code block', detail: '```', section: 'Blocks', tpl: '```${lang}\n${}\n```' },
  { label: 'Math block', detail: '$$', section: 'Blocks', tpl: '$$\n${}\n$$' },
  { label: 'Mermaid diagram', detail: 'flowchart', section: 'Blocks', tpl: '```mermaid\ngraph LR\n  ${A} --> ${B}\n```' },
  { label: 'Table', detail: '3 × 2', section: 'Blocks', tpl: '| ${Column} | Column | Column |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |' },
  { label: 'Collapsible section', detail: '<details>', section: 'Blocks', tpl: '<details>\n<summary>${Summary}</summary>\n\n${}\n\n</details>' },
  { label: 'Divider', detail: '---', section: 'Blocks', tpl: '---\n${}' },
  { label: 'Table of contents', detail: '[[toc]]', section: 'Blocks', tpl: '[[toc]]\n${}' },
  { label: 'Link', detail: '[text](url)', section: 'Insert', tpl: '[${text}](${url})' },
  { label: 'Note link', detail: '[[note]]', section: 'Insert', tpl: '[[${}]]' },
  { label: 'Image', detail: '![alt](url)', section: 'Insert', tpl: '![${alt}](${url})' },
  { label: 'Footnote', detail: '[^1]', section: 'Insert', tpl: '[^${1}]\n\n[^${1}]: ${}' },
  { label: 'Today’s date', detail: 'YYYY-MM-DD', section: 'Insert', tpl: () => today() + '${}' },
  { label: 'Current time', detail: 'HH:MM', section: 'Insert', tpl: () => now() + '${}' },
];

const SECTIONS = ['Text', 'Callouts', 'Blocks', 'Insert'];

const completions: Completion[] = ITEMS.map((it, i) => ({
  label: it.label,
  boost: 50 - i, // keep the menu in reading order instead of alphabetical
  detail: it.detail,
  type: 'keyword',
  section: { name: it.section, rank: SECTIONS.indexOf(it.section) },
  apply: (view, completion, from, to) => {
    const tpl = typeof it.tpl === 'function' ? it.tpl() : it.tpl;
    snippet(tpl)(view, completion, from - 1, to); // from is just after the "/"; replace it too
  },
}));

// files in Templates/ join the menu in their own section
const templates = (): Completion[] =>
  templateFiles(app.entries).map((path, i) => ({
    label: basename(path).replace(/\.(md|markdown|mdx|txt)$/i, '') + ' template',
    detail: 'Templates/',
    type: 'keyword',
    boost: -i,
    section: { name: 'Templates', rank: SECTIONS.length },
    apply: (view, _c, from, to) => {
      const title = basename(app.active ?? '').replace(/\.(md|markdown|mdx|txt)$/i, '');
      app.readText(path).then((t) => {
        const { text, cursor } = fill(t, title);
        view.dispatch({ changes: { from: from - 1, to, insert: text }, selection: { anchor: from - 1 + cursor }, userEvent: 'input' });
      });
    },
  }));

export function slashComplete(ctx: CompletionContext): CompletionResult | null {
  const m = ctx.matchBefore(/(?:^|\s)\/[\w ’'-]*$/);
  if (!m) return null;
  const slash = m.text.indexOf('/');
  const query = m.text.slice(slash + 1);
  // a space right after "/" (or two words in) means the user is just typing prose
  if (/^\s|\s\s/.test(query)) return null;
  // grouped while browsing; once there's a query the best match wins (sections would pin Text items above a
  // better match further down, e.g. "/meet" -> Numbered list over Meeting template)
  const all = [...completions, ...templates()];
  const options = query ? all.map(({ section: _, ...c }) => c) : all;
  // match the query after "/" so fuzzy filtering ignores the slash itself; re-query when it becomes (non-)empty
  return { from: m.from + slash + 1, options, filter: true, validFor: (t) => !t === !query && /^[\w ’'-]*$/.test(t) };
}
