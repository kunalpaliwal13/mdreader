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

test('slash menu inserts blocks; Plain disables it', async ({ page }) => {
  await ready(page);
  await newDoc(page, 'slash');
  await page.keyboard.type('/tab');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('Table');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  expect(await doc(page)).toContain('| Column | Column | Column |');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('/warn');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('Warning callout');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  expect(await doc(page)).toBe('> [!WARNING]\n> ');
  // a slash inside prose or a path doesn't open it
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('and/or');
  await expect(page.locator('.cm-tooltip-autocomplete')).toHaveCount(0);
  // Plain: "/" is just a character
  await page.keyboard.press('ControlOrMeta+Shift+e');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('/h');
  await page.waitForTimeout(200);
  await expect(page.locator('.cm-tooltip-autocomplete')).toHaveCount(0);
});

test('phone: top bar, bottom bar, drawer and sheets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const bar = page.locator('.mbar');
  await expect(bar).toBeVisible();
  await expect(page.locator('.tab')).toHaveCount(0); // tabs live in the file switcher on phones
  // primary toggle: preview -> edit
  await bar.getByRole('button', { name: /Edit/ }).click();
  await expect(page.locator('.editor-pane')).toBeVisible();
  await bar.getByRole('button', { name: /Preview/ }).click();
  await expect(page.locator('.editor-pane')).toBeHidden();
  // Files opens the drawer; picking a file closes it
  await bar.getByRole('button', { name: /Files/ }).click();
  await expect(page.locator('.side')).toBeVisible();
  await page.locator('.row[data-path="Welcome.md"]').click();
  await expect(page.locator('.side')).toHaveCount(0);
  // More -> Appearance opens as a bottom sheet; touch targets are big
  await bar.getByRole('button', { name: 'More' }).click();
  const item = page.getByRole('menuitem', { name: 'Appearance' });
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await item.click();
  const sheet = page.locator('.panel');
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.x + box.width)).toBe(390);
  // title opens the file switcher
  await page.locator('.panel [aria-label=Close]').click();
  await page.getByRole('button', { name: 'Switch file' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('folding: headings in the editor, callouts in the preview', async ({ page }) => {
  await ready(page);
  await newDoc(page, 'fold');
  await page.keyboard.type('# One\n\nalpha\n\n# Two\n\nbeta\n\n> [!NOTE]\nhidden text'); // Enter continues the "> "
  // fold "# One" from the chevron that appears beside the hovered line
  await page.locator('.cm-line', { hasText: 'One' }).hover();
  const chevron = page.locator('.cm-gutterElement.cm-hover .cm-fold-marker');
  await expect(chevron).toHaveCSS('opacity', '1');
  await chevron.click();
  await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(1);
  await expect(page.locator('.cm-content')).not.toContainText('alpha');
  await expect(page.locator('.cm-content')).toContainText('beta');
  await page.locator('.cm-foldPlaceholder').click(); // unfold
  await expect(page.locator('.cm-content')).toContainText('alpha');

  // callout folds in the preview and stays folded while typing
  const alert = preview(page).locator('.markdown-alert');
  await alert.locator('.markdown-alert-title').click();
  await expect(alert).toHaveClass(/folded/);
  await expect(alert.getByText('hidden text')).toBeHidden();
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' more');
  await expect(preview(page).locator('.markdown-alert')).toHaveClass(/folded/);
});

test('table editor: header + Enter makes a table, Tab/Enter move and align, empty row exits', async ({ page }) => {
  await ready(page);
  await newDoc(page, 'table');
  await page.keyboard.type('| Name | Age |');
  await page.keyboard.press('Enter'); // delimiter row + first body row
  await page.keyboard.type('Ann');
  await page.keyboard.press('Tab');
  await page.keyboard.type('31');
  await page.keyboard.press('Enter'); // new row, back in the column the Tab run started in
  await page.keyboard.type('Bartholomew');
  await page.keyboard.press('Tab');
  await page.keyboard.type('7');
  await page.keyboard.press('Shift+Tab'); // re-aligns and selects the previous cell
  await page.keyboard.type('Bo');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // empty last row: leave the table
  await page.keyboard.type('after');
  expect(await doc(page)).toBe(['| Name | Age |', '| ---- | --- |', '| Ann  | 31  |', '| Bo   | 7   |', '', 'after'].join('\n'));
  await expect(preview(page).locator('table tbody tr')).toHaveCount(2);
  await expect(preview(page).locator('p', { hasText: 'after' })).toBeVisible();

  // toolbar shows while the cursor is in the table
  const bar = page.getByRole('toolbar', { name: 'Table' });
  await expect(bar).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+Home'); // header, first column
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Align right' }).click();
  await expect(bar.getByRole('button', { name: 'Align right' })).toHaveAttribute('aria-pressed', 'true');
  await bar.getByRole('button', { name: 'Add column right' }).click();
  await page.keyboard.type('Id');
  await page.keyboard.press('Tab'); // to "Age"
  await bar.getByRole('button', { name: 'More table actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete column' }).click();
  expect(await doc(page)).toBe(['| Name | Id  |', '| ---: | --- |', '|  Ann |     |', '|   Bo |     |', '', 'after'].join('\n'));
  await expect(preview(page).locator('th').first()).toHaveAttribute('align', 'right');
  await page.keyboard.press('ControlOrMeta+End');
  await expect(bar).toHaveCount(0);
});

test('table editor: pasted tables stay as-is, escaped pipes survive, Plain leaves Enter alone', async ({ page }) => {
  await ready(page);
  await newDoc(page, 'table2');
  const raw = '|a|b \\| c|\n|-|-|\n|1|2|';
  await paste(page, raw);
  expect(await doc(page)).toBe(raw); // pasting never reformats
  await page.keyboard.press('Tab'); // last cell: re-align and add a row
  expect(await doc(page)).toBe(['| a   | b \\| c |', '| --- | ------ |', '| 1   | 2      |', '|     |        |'].join('\n'));
  await expect(preview(page).locator('th').nth(1)).toHaveText('b | c');

  await page.keyboard.press('ControlOrMeta+Shift+E'); // Plain
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('| x | y |');
  await page.keyboard.press('Enter');
  expect((await doc(page)).split('\n').slice(-3)).toEqual(['', '| x | y |', '']);
});
