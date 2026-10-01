import { test, expect } from './fixture';
import type { Page } from '@playwright/test';

const preview = (page: Page) => page.locator('.preview-pane .md');
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(preview(page).locator('h1').first()).toHaveText(/Welcome/);
};
const bg = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);

test('base16 scheme recolors app + editor, not the preview', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // dark preview background (wait out the theme view transition)
  await expect.poll(() => bg(page, '.preview-pane .scroller')).toBe('rgb(23, 23, 26)');
  const previewBefore = await bg(page, '.preview-pane .scroller');
  await page.getByRole('button', { name: 'Settings' }).click();
  // stepper: Default -> Obsidian via ›, then the full list for Nord
  await page.getByRole('button', { name: 'Next color scheme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'obsidian');
  expect(await bg(page, 'body')).toBe('rgb(30, 30, 30)'); // Obsidian #1e1e1e
  await page.getByRole('button', { name: /All color schemes/ }).click();
  await page.getByRole('option', { name: 'Nord' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'nord');
  expect(await bg(page, 'body')).toBe('rgb(46, 52, 64)'); // Nord base00
  expect(await bg(page, '.preview-pane .scroller')).toBe(previewBefore);
  // persisted
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'nord');
});

const newDoc = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'New file' }).click();
  await page.locator('.row input.rename').fill(name);
  await page.locator('.row input.rename').press('Enter');
  await page.locator('.cm-content').click();
};
const doc = (page: Page) =>
  page.locator('.cm-content').evaluate((el) =>
    [...el.querySelectorAll('.cm-line')]
      .map((l) => {
        const c = l.cloneNode(true) as HTMLElement;
        c.querySelectorAll('.cm-placeholder, .cm-widgetBuffer').forEach((x) => x.remove());
        return c.textContent;
      })
      .join('\n'),
  );
const paste = (page: Page, text: string) =>
  page.locator('.cm-content').evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'clipboardData', { value: dt });
    el.dispatchEvent(e);
  }, text);

test('smart typing: auto-pair, wrap selection, move lines, multi-cursor; Plain turns it off', async ({ page }) => {
  await ready(page);
  await newDoc(page, 'smart');
  await page.keyboard.type('(');
  expect(await doc(page)).toBe('()');
  await page.keyboard.press('Backspace'); // deletes the pair
  expect(await doc(page)).toBe('');

  await page.keyboard.type('word');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.type('*');
  expect(await doc(page)).toBe('*word*');

  // pasted markdown goes in verbatim
  await page.keyboard.press('ControlOrMeta+a');
  await paste(page, '**bold** (x) [y] `z` it\'s "q"');
  expect(await doc(page)).toBe('**bold** (x) [y] `z` it\'s "q"');

  // move line down, multi-cursor select-next
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('one\ntwo');
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('Alt+ArrowDown');
  expect(await doc(page)).toBe('two\none');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('cat cat');
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+d');
  await page.keyboard.press('ControlOrMeta+d');
  await page.keyboard.type('dog');
  expect(await doc(page)).toBe('dog dog');

  // Plain: brackets are just characters
  await page.getByRole('button', { name: 'Plain editor' }).click();
  await expect(page.locator('.status .chip')).toHaveText('Plain');
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('(');
  expect(await doc(page)).toBe('(');
  await page.keyboard.press('ControlOrMeta+Shift+e');
  await expect(page.locator('.status .chip')).toHaveCount(0);
});

const pasteHtml = (page: Page, html: string, text: string) =>
  page.locator('.cm-content').evaluate(
    (el, [h, t]) => {
      const dt = new DataTransfer();
      dt.setData('text/html', h);
      dt.setData('text/plain', t);
      const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'clipboardData', { value: dt });
      el.dispatchEvent(e);
    },
    [html, text],
  );

test('paste: rich HTML becomes markdown, code-editor HTML and ⌘⇧V stay plain', async ({ page }) => {
  await ready(page);
  await newDoc(page, 'paste');
  await pasteHtml(
    page,
    '<h2>Title</h2><p><strong>bold</strong> and <a href="https://x.io">link</a></p><ul><li>one</li><li>two</li></ul><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    'Title bold and link one two a b 1 2',
  );
  await expect.poll(() => doc(page)).toContain('## Title');
  const md = await doc(page);
  expect(md).toContain('**bold** and [link](https://x.io)');
  expect(md).toContain('- one\n- two');
  expect(md).toContain('| a | b |');

  await page.keyboard.press('ControlOrMeta+a');
  await pasteHtml(page, '<div style="color:red"><span style="color:blue">const x = 1;</span></div>', 'const x = 1;');
  await expect.poll(() => doc(page)).toBe('const x = 1;');

  await page.keyboard.press('ControlOrMeta+a');
  await page.locator('.cm-content').press('ControlOrMeta+Shift+v');
  await pasteHtml(page, '<h1>Big</h1>', 'Big');
  await expect.poll(() => doc(page)).toBe('Big');
});
