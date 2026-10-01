// Rich clipboard HTML (web pages, Google Docs, Notion) -> markdown. Loaded on first use.

// Only convert HTML that carries document structure; code editors (VS Code etc.) put styled
// <div>/<span> soup on the clipboard, and their plain text is what the user meant.
const STRUCTURE = /<(h[1-6]|p|ul|ol|li|table|a\s|strong|b|em|i|blockquote|pre|img|br|hr)[\s>/]/i;

export const isRichHtml = (html: string) => STRUCTURE.test(html);

let svc: Promise<(html: string) => string> | null = null;

export function htmlToMarkdown(html: string): Promise<string> {
  svc ??= Promise.all([import('turndown'), import('turndown-plugin-gfm')]).then(([{ default: Turndown }, gfm]) => {
    const td = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
    td.use(gfm.gfm);
    td.remove(['style', 'script', 'meta', 'title' as keyof HTMLElementTagNameMap]);
    // Google Docs wraps everything in <b style="font-weight:normal">
    td.addRule('gdocs-wrapper', {
      filter: (n) => n.nodeName === 'B' && /font-weight:\s*normal/.test(n.getAttribute('style') ?? ''),
      replacement: (c) => c,
    });
    // "- item" / "1. item" instead of turndown's "-   item"
    td.addRule('tight-list-item', {
      filter: 'li',
      replacement: (content, node) => {
        const parent = node.parentNode as HTMLElement;
        let prefix = '- ';
        if (parent.nodeName === 'OL') {
          const start = Number(parent.getAttribute('start') ?? 1);
          prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
        }
        const body = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, '\n' + ' '.repeat(prefix.length));
        return prefix + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '');
      },
    });
    return (h: string) => td.turndown(h).replace(/\n{3,}/g, '\n\n').trim();
  });
  return svc.then((f) => f(html));
}
