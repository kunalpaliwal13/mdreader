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
  await expect.poll(() => bg(page, '.preview-pane .scroller')).toBe('rgb(15, 15, 17)');
  const previewBefore = await bg(page, '.preview-pane .scroller');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Default/ }).click();
  await page.getByRole('option', { name: 'Nord' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'nord');
  expect(await bg(page, 'body')).toBe('rgb(46, 52, 64)'); // Nord base00
  expect(await bg(page, '.preview-pane .scroller')).toBe(previewBefore);
  // persisted
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'nord');
});
