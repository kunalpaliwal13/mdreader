import { test, expect, editorText } from './fixture';
import type { Page } from '@playwright/test';

const preview = (page: Page) => page.locator('.preview-pane .md');
const row = (page: Page, path: string) => page.locator(`.row[data-path="${path}"]`);
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(preview(page).locator('h1').first()).toHaveText(/Welcome/);
};

test('palette: go to file and run commands', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'New file' }).click();
  await page.locator('.row input.rename').fill('zebra notes');
  await page.locator('.row input.rename').press('Enter');
  await expect(page.locator('.tab.active')).toContainText('zebra notes');

  await page.keyboard.press('ControlOrMeta+p');
  await page.getByLabel('Palette query').fill('welc');
  await page.keyboard.press('Enter');
  await expect(page.locator('.tab.active')).toContainText('Welcome');

  await page.keyboard.press('ControlOrMeta+Shift+p');
  await expect(page.getByLabel('Palette query')).toHaveValue('>');
  await page.getByLabel('Palette query').fill('>dark');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // fuzzy: "zn" finds "zebra notes"
  await page.keyboard.press('ControlOrMeta+p');
  await page.getByLabel('Palette query').fill('zn');
  await expect(page.getByRole('option').first()).toContainText('zebra notes');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('search across files jumps to the line', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('ControlOrMeta+Shift+f');
  await page.getByPlaceholder('Search in all files').fill('def fib');
  const hit = page.locator('.hit').first();
  await expect(hit).toContainText('def fib');
  const line = Number(await hit.locator('.ln').textContent());
  await hit.click();
  await expect(page.locator('.status')).toContainText(`Ln ${line},`);
  await expect(page.locator('.cm-activeLine')).toContainText('def fib');
});

test('outline jumps, wikilinks create + resolve, backlinks, autocomplete', async ({ page }) => {
  await ready(page);
  await page.getByRole('tab', { name: 'Outline' }).click();
  await expect(page.locator('.heading').first()).toHaveText('Welcome to mdreader');
  await page.locator('.heading', { hasText: 'Footnotes' }).click();
  await expect(preview(page).locator('h2', { hasText: 'Footnotes' })).toBeInViewport();

  // resolved wikilink vs missing one
  await expect(preview(page).getByRole('link', { name: 'Welcome', exact: true })).toHaveAttribute('data-path', 'Welcome.md');
  const missing = preview(page).locator('a.wikilink-missing', { hasText: 'this one' });
  await expect(missing).toHaveCount(1);
  await missing.click();
  await expect(page.locator('.tab.active')).toContainText('My first note');
  await page.getByRole('tab', { name: 'Files' }).click();
  await expect(row(page, 'My first note.md')).toBeVisible();

  // [[ autocomplete inserts a link back to Welcome
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('See [[Welc');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('Welcome');
  await page.waitForTimeout(150); // CodeMirror ignores Enter for 75ms after the list opens
  await page.keyboard.press('Enter');
  await expect.poll(() => editorText(page)).toContain('See [[Welcome]]');
  expect(await editorText(page)).not.toContain('[[Welcome]]]]');

  // Welcome now lists the mention
  await expect(page.locator('.status .save')).toHaveText('Saved', { timeout: 5000 });
  await page.locator('.tab', { hasText: 'Welcome' }).click();
  await page.getByRole('tab', { name: 'Outline' }).click();
  await expect(page.locator('.mention')).toContainText('My first note');
});

test('split resize and scroll sync', async ({ page }) => {
  await ready(page);
  const pane = page.locator('.editor-pane');
  const before = (await pane.boundingBox())!.width;
  const d = (await page.locator('.divider').boundingBox())!;
  await page.mouse.move(d.x + 3, d.y + 200);
  await page.mouse.down();
  await page.mouse.move(d.x - 200, d.y + 200, { steps: 5 });
  await page.mouse.up();
  expect((await pane.boundingBox())!.width).toBeLessThan(before - 150);

  // scrolling the editor to the bottom moves the preview down too
  await page.locator('.cm-scroller').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect.poll(() => page.locator('.preview-pane .scroller').evaluate((el) => el.scrollTop)).toBeGreaterThan(1500);
});

test('tree keyboard navigation', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.locator('.row input.rename').fill('alpha');
  await page.locator('.row input.rename').press('Enter');
  await expect(row(page, 'alpha')).toHaveCount(1);
  await row(page, 'Welcome.md').click();
  await page.keyboard.press('ArrowUp');
  await expect(row(page, 'alpha')).toHaveClass(/selected/);
  await page.keyboard.press('ArrowDown');
  await expect(row(page, 'Welcome.md')).toHaveClass(/selected/);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('F2');
  await expect(page.locator('.row input.rename')).toHaveValue('alpha');
  await page.keyboard.press('Escape');
});

test('PWA manifest and service worker are served', async ({ page, request }) => {
  await ready(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest.name).toBe('mdreader');
  expect((await request.get('sw.js')).ok()).toBe(true);
});
