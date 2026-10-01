// #tags, Obsidian rules: letters, digits, _ - and / (nesting); at least one non-digit (#2024 isn't a tag);
// only at the start of a line or after whitespace (so url#anchor and a#b aren't tags). Matched case-insensitively.
const BODY = '[\\p{L}\\p{N}_/-]*[\\p{L}_/-][\\p{L}\\p{N}_/-]*';
export const TAG = new RegExp(`(?<=^|\\s)#(${BODY})`, 'gu');
export const TAG_QUERY = new RegExp(`^#${BODY}$`, 'u');

/** Lines [from, to) of the front matter's `tags:` field (scalar, [a, b] or a dash list), or null. */
export function frontMatterTagLines(lines: string[]): [number, number] | null {
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const at = lines.findIndex((l, i) => i > 0 && i < end && /^tags?\s*:/i.test(l));
  if (at < 0) return null;
  let to = at + 1;
  while (to < end && /^\s*-\s+/.test(lines[to])) to++;
  return [at, to];
}

/** Bare tag names in a front matter tags field: "tags: [a, b]", "tags: a, b", "tags:\n  - a". */
export function frontMatterTags(field: string[]): string[] {
  const [first = '', ...rest] = field;
  const inline = first.replace(/^tags?\s*:/i, '').trim();
  const raw = inline ? inline.replace(/^\[|\]$/g, '').split(/[,\s]+/) : rest.map((l) => l.replace(/^\s*-\s+/, ''));
  return raw.map((t) => t.trim().replace(/^["']|["']$/g, '').replace(/^#/, '')).filter((t) => TAG_QUERY.test('#' + t));
}

/** Every tag in a note (lowercase, no '#'): inline ones outside code, plus front matter tags. */
export function tagsOf(md: string): string[] {
  const out = new Set<string>();
  const lines = md.split('\n');
  const fm = frontMatterTagLines(lines);
  if (fm) for (const t of frontMatterTags(lines.slice(fm[0], fm[1]))) out.add(t.toLowerCase());
  let fence = '';
  const start = lines[0]?.trim() === '---' ? lines.indexOf('---', 1) + 1 : 0;
  for (const l of lines.slice(start)) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(l);
    if (f) {
      fence = fence ? (f[1][0] === fence[0] ? '' : fence) : f[1];
      continue;
    }
    if (fence) continue;
    for (const m of l.replace(/`[^`]*`/g, '').matchAll(TAG)) out.add(m[1].toLowerCase());
  }
  return [...out];
}
