import { test, expect } from './fixture';
import type { Page } from '@playwright/test';

const preview = (page: Page) => page.locator('.preview-pane .md');
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(preview(page).locator('h1').first()).toHaveText(/Welcome/);
};
const paste = (page: Page, text: string) =>
  page.locator('.cm-content').evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'clipboardData', { value: dt });
    el.dispatchEvent(e);
  }, text);
const replaceDoc = async (page: Page, text: string) => {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await paste(page, text);
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

test('linking: [[note#Heading]], ![[embeds]] of notes and sections, image sizes, hover preview, heading autocomplete', async ({ page }) => {
  await ready(page);
  await create(page, 'file', 'Other');
  await replaceDoc(page, '# Other\n\nIntro.\n\n## Plan\n\n- step one\n\n## Later\n\nNot in plan.\n');
  await page.locator('.tree .row', { hasText: 'Welcome' }).click();
  await replaceDoc(page, '# Host\n\nSee [[Other#Plan]] here.\n\n![[Other#Plan]]\n\n![[Welcome]]\n\n![alt|120](missing.png)\n');

  const pv = preview(page);
  const embed = pv.locator('.embed');
  await expect(embed).toHaveCount(1); // the self-embed stays a link
  await expect(embed.locator('h2')).toHaveText('Plan');
  await expect(embed).toContainText('step one');
  await expect(embed).not.toContainText('Not in plan');
  await expect(pv.locator('p > a[data-wikilink]', { hasText: 'Welcome' })).toHaveAttribute('data-path', 'Welcome.md');
  await expect(pv.locator('img[alt="alt"]')).toHaveAttribute('width', '120');

  // hover a heading link: the popover shows just that section
  const link = pv.locator('p a[data-wikilink]', { hasText: 'Other › Plan' });
  await link.hover();
  const pop = page.getByRole('tooltip');
  await expect(pop).toContainText('step one');
  await expect(pop).not.toContainText('Not in plan');

  // clicking opens the note at the heading
  await link.click();
  await expect(page.getByRole('tab', { name: 'Other' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.status')).toContainText('Ln 5,');

  // [[note# suggests that note's headings
  await page.locator('.tree .row', { hasText: 'Welcome' }).click();
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n[[Other#');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('Plan');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('Later');
});
