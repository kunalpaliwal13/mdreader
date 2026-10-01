import { test, expect } from './fixture';
import type { Page } from '@playwright/test';

const preview = (page: Page) => page.locator('.preview-pane .md');
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(preview(page).locator('h1').first()).toHaveText(/Welcome/);
};
const create = async (page: Page, kind: 'file' | 'folder', name: string) => {
  await page.getByRole('button', { name: kind === 'file' ? 'New file' : 'New folder' }).click();
  await page.locator('.row input.rename').fill(name);
  await page.locator('.row input.rename').press('Enter');
};

test('search: case / word / regex, name matches, context, globs, Enter opens the top hit', async ({ page }) => {
  await ready(page);
  await create(page, 'folder', 'Fibs');
  await create(page, 'file', 'zeta');
  await page.locator('.cm-content').click();
  await page.keyboard.type('fib FIB fibonacci\nalpha\nbeta fib');

  await page.keyboard.press('ControlOrMeta+Shift+f');
  const q = page.getByPlaceholder('Search in all files');
  const summary = page.getByRole('status');
  const zeta = page.locator('.hit', { has: page.locator('.ln') }).filter({ hasText: 'fibonacci' });
  await q.fill('fib');
  // names first: the folder, then content hits
  await expect(page.locator('.results .file').first()).toContainText('Fibs');
  await expect(summary).toContainText('by name');
  await expect(zeta.locator('mark')).toHaveCount(3); // fib, FIB, fib(onacci)

  await page.getByRole('button', { name: 'Match whole word' }).click();
  await expect(zeta.locator('mark')).toHaveCount(2);
  await page.getByRole('button', { name: 'Match case' }).click();
  await expect(zeta.locator('mark')).toHaveCount(1);
  await page.getByRole('button', { name: 'Match case' }).click();
  await page.getByRole('button', { name: 'Match whole word' }).click();

  // regex, and a broken one
  await page.getByRole('button', { name: 'Use regular expression' }).click();
  await q.fill('^beta');
  await expect(page.locator('.hit')).toHaveCount(1);
  await expect(page.locator('.hit .ln')).toHaveText('3');
  await q.fill('(');
  await expect(summary).toHaveText('Invalid regular expression');
  await page.getByRole('button', { name: 'Use regular expression' }).click();

  // one line of context around each hit
  await q.fill('alpha');
  await page.getByRole('button', { name: 'Context lines' }).click();
  await expect(page.locator('.hit.ctx')).toHaveCount(2);
  await page.getByRole('button', { name: 'Context lines' }).click();

  // include / exclude globs, and the reminder when they're tucked away
  await q.fill('def fib');
  await expect(page.locator('.results .file')).toContainText(['Welcome.md']);
  await page.getByRole('button', { name: 'File filters' }).click();
  await page.getByLabel('Files to exclude').fill('Welcome.md');
  await expect(summary).toHaveText('No results');
  await page.getByLabel('Files to exclude').fill('');
  await page.getByLabel('Files to include').fill('*.txt, notes/**');
  await expect(summary).toHaveText('No results');
  await page.getByRole('button', { name: 'File filters' }).click();
  await expect(summary).toContainText('filtered');
  await page.getByRole('button', { name: 'File filters' }).click();
  await page.getByLabel('Files to include').fill('');

  // Enter opens the top hit and selects the match
  await q.fill('beta');
  await q.press('Enter');
  await expect(page.locator('.status')).toContainText('Ln 3, Col 5');
  await expect(page.locator('.cm-activeLine')).toContainText('beta fib');
});
