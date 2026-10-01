import { test, expect } from './fixture';
import type { Page } from '@playwright/test';

const shots = process.env.SHOTS;
const shot = async (page: Page, name: string) => shots && page.screenshot({ path: `${shots}/${test.info().project.name}-${name}.png` });
const preview = (page: Page) => page.locator('.preview-pane .md');
const row = (page: Page, path: string) => page.locator(`.row[data-path="${path}"]`);

test('welcome doc renders every syntax', async ({ page }) => {
  await page.goto('/');
  const md = preview(page);
  await expect(md.locator('h1').first()).toHaveText(/Welcome to mdreader/);
  await expect(md.locator('.front-matter dt').first()).toHaveText('title');
  await expect(md.locator('.toc a').first()).toBeVisible();
  await expect(md.locator('table')).toHaveCount(1);
  await expect(md.locator('.task-list-item input[type=checkbox]')).toHaveCount(3);
  await expect(md.locator('.markdown-alert')).toHaveCount(5);
  await expect(md.locator('.katex').first()).toBeVisible();
  await expect(md.locator('.math-display')).toHaveCount(2);
  await expect(md.locator('.mermaid svg')).toHaveCount(2, { timeout: 20_000 });
  await expect(md.locator('pre code .hljs-keyword').first()).toBeVisible();
  await expect(md.locator('.footnotes li')).toHaveCount(2);
  await expect(md.locator('dl dt').filter({ hasText: 'WASM' })).toHaveCount(1);
  await expect(md.locator('mark')).toHaveText('highlight');
  await expect(md.locator('td strong').filter({ hasText: '+ FP8' })).toHaveCount(1);
  await expect(md.locator('sub')).toHaveText('2');
  await expect(md.locator('details summary')).toHaveText('Click to expand');
  await expect(md).toContainText('🚀');
  // heading ids survive sanitizing (bare "images" would be stripped as DOM clobbering)
  await expect(md.locator('h2', { hasText: 'Images' })).toHaveAttribute('id', 'user-content-images');
  await md.locator('.toc a', { hasText: 'Images' }).click();
  await expect(md.locator('h2', { hasText: 'Images' })).toBeInViewport();
  await md.getByRole('link', { name: 'relative link' }).click();
  await expect(md.locator('h2', { hasText: 'Tables' })).toBeInViewport();
  await shot(page, 'welcome');
});

test('file tree CRUD, edit, persist, move, trash, restore', async ({ page }) => {
  await page.goto('/');
  await expect(row(page, 'Welcome.md')).toBeVisible();

  // new folder -> rename
  await page.getByRole('button', { name: 'New folder' }).click();
  const input = page.locator('.row input.rename');
  await input.fill('notes');
  await input.press('Enter');
  await expect(row(page, 'notes')).toBeVisible();

  // new file inside the selected folder -> rename
  await row(page, 'notes').click();
  await page.getByRole('button', { name: 'New file' }).click();
  await page.locator('.row input.rename').fill('idea');
  await page.locator('.row input.rename').press('Enter');
  await expect(row(page, 'notes/idea.md')).toBeVisible();

  // type and see preview
  await page.locator('.cm-content').click();
  await page.keyboard.type('# Hello world\n\n- [ ] task one\n\n');
  await expect(page.locator('.cm-line').last()).toHaveText(''); // Enter on empty item exits the list
  await expect(preview(page).locator('h1')).toHaveText('Hello world');

  // toggle task from preview writes back to the source
  await preview(page).locator('input[type=checkbox]').click();
  await expect(page.locator('.cm-content')).toContainText('[x] task one');

  // bold shortcut
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('bold');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('ControlOrMeta+b');
  await expect(page.locator('.cm-content')).toContainText('**bold**');

  // persisted across reload
  await expect(page.locator('.status .save')).toHaveText('Saved', { timeout: 5000 });
  await page.reload();
  await expect(preview(page).locator('h1')).toHaveText('Hello world');
  await expect(page.locator('.tab.active')).toContainText('idea');

  // rename via F2
  await row(page, 'notes/idea.md').click();
  await page.keyboard.press('F2');
  await page.locator('.row input.rename').fill('plan.md');
  await page.locator('.row input.rename').press('Enter');
  await expect(row(page, 'notes/plan.md')).toBeVisible();
  await expect(page.locator('.tab.active')).toContainText('plan');

  // drag Welcome.md into notes/
  await row(page, 'Welcome.md').dragTo(row(page, 'notes'));
  await expect(row(page, 'notes/Welcome.md')).toBeVisible();

  // context menu -> duplicate
  await row(page, 'notes/plan.md').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(row(page, 'notes/plan 1.md')).toBeVisible();

  // delete -> trash -> restore
  await row(page, 'notes/plan 1.md').click();
  await page.keyboard.press('Delete');
  await expect(row(page, 'notes/plan 1.md')).toHaveCount(0);
  await page.getByRole('button', { name: /Trash/ }).click();
  await page.getByRole('button', { name: 'Restore' }).first().click();
  await expect(row(page, 'notes/plan 1.md')).toBeVisible();

  // filter
  await page.getByPlaceholder('Filter files').fill('plan');
  await expect(row(page, 'notes/Welcome.md')).toHaveCount(0);
  await expect(row(page, 'notes/plan.md')).toBeVisible();
  await page.getByPlaceholder('Filter files').fill('');
  await shot(page, 'tree');
});

test('modes, theme, export', async ({ page }) => {
  await page.goto('/');
  await expect(preview(page).locator('h1').first()).toBeVisible();
  // split toggle -> edit only, quick Preview button -> preview, Edit -> back to edit
  await page.getByRole('button', { name: 'Split view' }).click();
  await expect(page.locator('.preview-pane')).toBeHidden();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.editor-pane')).toBeHidden();
  await expect(page.locator('.preview-pane')).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('.preview-pane')).toBeHidden();
  await page.getByRole('button', { name: 'Split view' }).click();
  await expect(page.locator('.preview-pane')).toBeVisible();

  // one-click theme toggle next to the view buttons
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /Sepia/ }).click();
  await expect(preview(page)).toHaveClass(/preset-sepia/);
  await shot(page, 'dark-sepia');
  // app shell never scrolls as a whole; only the panes do
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  // editor line width is configurable like the preview's
  await page.getByLabel('Editor line width').fill('520');
  await expect.poll(() => page.locator('.cm-content').evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(520);
  await page.keyboard.press('Escape');

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: /HTML/ }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('Welcome.html');
  const html = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  expect(html).toContain('class="md preset-sepia');
  expect(html).toContain('katex');
  expect(html).toContain('<svg');
});

test('import files + zip, paste image, export zip, pdf', async ({ page }) => {
  await page.goto('/');
  await expect(row(page, 'Welcome.md')).toBeVisible();

  // import two markdown files via the picker
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByRole('menuitem', { name: /Markdown files/ }).click();
  await (await chooser).setFiles([
    { name: 'a.md', mimeType: 'text/markdown', buffer: Buffer.from('# From A\n\n[go to b](sub/b.md)') },
    { name: 'skip.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') },
  ]);
  await expect(row(page, 'a.md')).toBeVisible();
  await expect(row(page, 'skip.exe')).toHaveCount(0);

  // import a zip with a nested folder
  const { zipSync, strToU8 } = await import('fflate');
  const zip = zipSync({ 'sub/b.md': strToU8('# From B'), 'sub/deep/c.md': strToU8('# C') });
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByRole('menuitem', { name: /ZIP archive/ }).click();
  await (await chooser2).setFiles([{ name: 'bundle.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) }]);
  await expect(row(page, 'sub/b.md')).toBeVisible();
  await row(page, 'sub/deep').click();
  await expect(row(page, 'sub/deep/c.md')).toBeVisible();

  // relative link between docs opens the target
  await row(page, 'a.md').click();
  await preview(page).getByRole('link', { name: 'go to b' }).click();
  await expect(page.locator('.tab.active')).toContainText('b');
  await expect(preview(page).locator('h1')).toHaveText('From B');

  // paste an image into the editor -> saved to sub/assets/, rendered from OPFS
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.locator('.cm-content').evaluate(async (el) => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([png], 'dot.png', { type: 'image/png' }));
    // Firefox strips files from synthetic ClipboardEvent init; attach the DataTransfer directly
    const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'clipboardData', { value: dt });
    el.dispatchEvent(e);
  });
  await expect(page.locator('.cm-content')).toContainText('![dot](assets/dot.png)');
  await row(page, 'sub/assets').click();
  await expect(row(page, 'sub/assets/dot.png')).toBeVisible();
  await expect(preview(page).locator('img')).toHaveAttribute('src', /^blob:/);

  // export folder as zip
  const dl = page.waitForEvent('download');
  await row(page, 'sub').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Export as ZIP' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('sub.zip');
  const buf = Buffer.concat(await (await file.createReadStream()).toArray());
  const { unzipSync } = await import('fflate');
  expect(Object.keys(unzipSync(new Uint8Array(buf))).sort()).toEqual(['assets/dot.png', 'b.md', 'deep/c.md']);

  // PDF: print runs from a hidden iframe without errors
  await page.evaluate(() => (window as any).__printed = 0);
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: /PDF/ }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('.toast.error')).toHaveCount(0);
});
