// Headings read straight from markdown source (no render): [[note#Heading]] jumps and autocomplete.
export type SrcHeading = { level: number; text: string; line: number };

/** ATX headings outside fenced code. */
export function mdHeadings(md: string): SrcHeading[] {
  const out: SrcHeading[] = [];
  let fence = '';
  md.split('\n').forEach((l, i) => {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(l);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length && !l.slice(f[0].length).trim()) fence = '';
      return;
    }
    const m = !fence && /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(l);
    if (m) out.push({ level: m[1].length, text: m[2], line: i + 1 });
  });
  return out;
}

/** How headings are matched (Obsidian-style): markup stripped, whitespace collapsed, case-insensitive. */
export const headingKey = (s: string) =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~=[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** "note#Heading" -> ["note", "Heading"]; "#Heading" -> ["", "Heading"]. */
export function splitTarget(target: string): [string, string] {
  const i = target.indexOf('#');
  return i < 0 ? [target.trim(), ''] : [target.slice(0, i).trim(), target.slice(i + 1).trim()];
}
