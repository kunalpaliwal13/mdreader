// Workspace search, ripgrep-style: case / whole word / regex, include + exclude globs, context lines, name matches.
import { TAG_QUERY, frontMatterTagLines } from './tags';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Opts = { query: string; caseSensitive: boolean; wholeWord: boolean; regex: boolean };
export type Range = [number, number];

/** null = nothing to search for; Error = the regex doesn't compile. */
export function matcher(o: Opts): RegExp | Error | null {
  if (!o.query) return null;
  // "#tag" finds that tag and its children (#tag/sub), not #tagged
  if (!o.regex && TAG_QUERY.test(o.query)) return new RegExp(`(?<=^|\\s)${esc(o.query)}(?:/[\\p{L}\\p{N}_-]+)*(?![\\p{L}\\p{N}_/-])`, 'giu');
  const src = o.regex ? o.query : esc(o.query);
  const flags = 'g' + (o.caseSensitive ? '' : 'i');
  try {
    // \b is ASCII-only; Unicode lookarounds keep "café" and "नमस्ते" whole words
    return o.wholeWord ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`, flags + 'u') : new RegExp(src, flags);
  } catch (e) {
    if (o.wholeWord) {
      try {
        return new RegExp(`\\b(?:${src})\\b`, flags); // regexes that are only valid without the u flag
      } catch {
        /* report the first error */
      }
    }
    return e as Error;
  }
}

/** Non-empty matches in a string. */
export function ranges(re: RegExp, s: string, max = 50): Range[] {
  const out: Range[] = [];
  re.lastIndex = 0;
  for (let m; out.length < max && (m = re.exec(s)); ) {
    if (m[0].length) out.push([m.index, m.index + m[0].length]);
    else re.lastIndex++; // zero-width (^, \b, x*): skip, never loop
  }
  return out;
}

/** Comma-separated globs, gitignore-ish: no slash = any depth, `**` = any folders, `dir/` = everything inside. */
export function globs(list: string): RegExp[] {
  return list
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => {
      let s = g.replace(/^\.?\//, '').replace(/\/$/, '/**');
      const anyDepth = s.startsWith('**/');
      if (anyDepth) s = s.slice(3);
      const re = s
        .split('**')
        .map((part) => part.split('*').map((p) => p.split('?').map((x) => x.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('[^/]')).join('[^/]*'))
        .join('.*');
      return new RegExp(s.includes('/') && !anyDepth ? `^${re}(?:/.*)?$` : `(?:^|/)${re}(?:/|$)`, 'i');
    });
}

export const included = (path: string, include: RegExp[], exclude: RegExp[]) =>
  (!include.length || include.some((r) => r.test(path))) && !exclude.some((r) => r.test(path));

export type Hit = { line: number; text: string; marks: Range[]; first?: Range; context?: boolean };

/** Hits for one file: matching lines (trimmed around the first match) plus optional ±1 context lines. */
export function searchText(re: RegExp, text: string, context: boolean, max: number, tag?: string): { hits: Hit[]; count: number } {
  const lines = text.split('\n');
  const hits: Hit[] = [];
  let count = 0;
  // a #tag search also finds the bare name in the front matter's tags field
  const fm = tag ? frontMatterTagLines(lines) : null;
  const bare = tag && new RegExp(`(?<=^|[\\s\\[,'"])${esc(tag)}(?:/[\\p{L}\\p{N}_-]+)*(?=$|[\\s\\],'"])`, 'giu');
  for (let i = 0; i < lines.length && count < max; i++) {
    const r = fm && bare && i >= fm[0] && i < fm[1] ? ranges(bare, i === fm[0] ? lines[i].replace(/^(\s*tags?\s*:)/i, (m) => ' '.repeat(m.length)) : lines[i]) : ranges(re, lines[i]);
    if (!r.length) continue;
    count++;
    // keep the first match in view: cut long lines ~24 chars before it, drop indentation
    const from = Math.max(0, r[0][0] - 24);
    const lead = from ? '…' : '';
    const raw = lines[i].slice(from, from + 200);
    const body = raw.trimStart();
    const text = lead + body;
    const shift = lead.length - from - (raw.length - body.length);
    const marks = r.map(([a, b]): Range => [Math.max(0, a + shift), Math.min(b + shift, text.length)]).filter(([a, b]) => a < b);
    hits.push({ line: i + 1, text, marks, first: r[0] });
  }
  if (!context) return { hits, count };
  const at = new Set(hits.map((h) => h.line));
  const ctx: Hit[] = [];
  for (const h of hits)
    for (const n of [h.line - 1, h.line + 1])
      if (n >= 1 && n <= lines.length && !at.has(n)) (at.add(n), ctx.push({ line: n, text: lines[n - 1].slice(0, 200).trimStart(), marks: [], context: true }));
  return { hits: [...hits, ...ctx].sort((a, b) => a.line - b.line), count };
}
