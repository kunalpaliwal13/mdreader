// Templates/ folder + daily notes. Variables: {{date}} {{time}} {{title}}; {{cursor}} marks where the caret lands.
import { isMarkdown, type Entry } from './fs';

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar date (toISOString would give yesterday before 05:30 in India). */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const TEMPLATES = 'Templates';
export const DAILY = 'Daily';

/** Markdown files under Templates/, by name. */
export const templateFiles = (entries: Entry[]) =>
  entries
    .filter((e) => e.kind === 'file' && isMarkdown(e.path) && e.path.toLowerCase().startsWith(TEMPLATES.toLowerCase() + '/'))
    .map((e) => e.path)
    .sort((a, b) => a.localeCompare(b));

/** Fill the variables; `cursor` is where {{cursor}} was (or the end). */
export function fill(tpl: string, title: string): { text: string; cursor: number } {
  const filled = tpl.replace(/\{\{\s*(date|time|title)\s*\}\}/gi, (_, k: string) =>
    k.toLowerCase() === 'date' ? localDate() : k.toLowerCase() === 'time' ? localTime() : title,
  );
  const at = filled.search(/\{\{\s*cursor\s*\}\}/i);
  const text = filled.replace(/\{\{\s*cursor\s*\}\}/gi, '');
  return { text, cursor: at < 0 ? text.length : at };
}
