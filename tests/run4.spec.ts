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

test('tags: preview pills + editor tint, front matter tags, tag list in empty search, #tag search, autocomplete', async ({ page }) => {
  await ready(page);
  await create(page, 'file', 'Tagged');
  await replaceDoc(page, '---\ntags: [alpha]\n---\n# Tagged\n\nAbout #project/web and #2024 and `#code`.\n');
  const pv = preview(page);
  await expect(pv.locator('a.tag')).toHaveText(['alpha', '#project/web']); // #2024 and code aren't tags
  await expect(page.locator('.cm-content .cm-tag')).toHaveText(['#project/web']);

  // a tag pill searches the workspace
  await pv.locator('a.tag', { hasText: '#project/web' }).click();
  const q = page.getByPlaceholder('Search in all files');
  await expect(q).toHaveValue('#project/web');
  await expect(page.locator('.results .file')).toContainText(['Tagged.md']);

  // nothing typed: the workspace's tags; a front matter tag finds its tags: line
  await q.fill('');
  const chips = page.locator('button.tag');
  await expect(chips.filter({ hasText: '#alpha' })).toHaveCount(1);
  await expect(chips.filter({ hasText: '#ideas' })).toHaveCount(1); // from Welcome.md
  await chips.filter({ hasText: '#alpha' }).click();
  await expect(q).toHaveValue('#alpha');
  await expect(page.locator('.hit .ln')).toHaveText(['2']);

  // a parent tag finds its children, not longer tags
  await q.fill('#project');
  await expect(page.locator('.results .file')).toContainText(['Tagged.md']);
  await q.fill('#proj');
  await expect(page.getByRole('status')).toHaveText('No results');

  // # suggests workspace tags in the editor
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' #pro');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('project/web');
});

test('daily note + templates: calendar icon, Templates/Daily.md, slash menu and palette', async ({ page }) => {
  await ready(page);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await create(page, 'folder', 'Templates');
  await page.locator('.row[data-path="Templates"]').click();
  await create(page, 'file', 'Daily');
  await replaceDoc(page, '# {{date}}\n\nPlan:\n');
  await create(page, 'file', 'Meeting');
  await replaceDoc(page, 'Meeting on {{date}} in {{title}}\nAttendees: {{cursor}}\n');
  await expect(page.locator('.row[data-path="Templates/Meeting.md"]')).toHaveCount(1);

  // today's note comes from Templates/Daily.md
  await page.getByRole('button', { name: "Today's note" }).click();
  await expect(page.getByRole('tab', { name: today })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.row[data-path="Daily/' + today + '.md"]')).toHaveCount(1);
  await expect(preview(page).locator('h1')).toHaveText(today);

  // templates in the slash menu: variables filled, caret at {{cursor}}
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n/meet');
  await expect(page.locator('.cm-tooltip-autocomplete li[aria-selected]')).toContainText('Meeting template'); // best match first
  await page.waitForTimeout(150); // CodeMirror ignores Enter right after the list opens
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ann');
  await expect(page.locator('.cm-content')).toContainText(`Meeting on ${today} in ${today}`);
  await expect(page.locator('.cm-content')).toContainText('Attendees: Ann');

  // and in the palette
  await page.keyboard.press('ControlOrMeta+Shift+p');
  await page.getByLabel('Palette query').fill('>insert template');
  await expect(page.getByRole('option', { name: /Insert template: Meeting/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // a second click opens the same note instead of making another
  await page.getByRole('button', { name: "Today's note" }).click();
  await expect(page.locator('.row[data-path^="Daily/"]')).toHaveCount(1);
});

test('bookmarks (file + heading), recents first in ⌘P, pinned tabs, reopen closed tab', async ({ page }) => {
  await ready(page);
  await create(page, 'file', 'Alpha');
  await replaceDoc(page, '# Alpha\n\n## Deep section\n\ntext\n');
  await create(page, 'file', 'Beta');

  // bookmark a file from the tree and a heading from the outline
  await page.locator('.row[data-path="Alpha.md"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Bookmark', exact: true }).click();
  await expect(page.locator('.mark')).toHaveCount(1);
  await page.locator('.row[data-path="Alpha.md"]').click();
  await page.getByRole('tab', { name: 'Outline' }).click();
  await page.locator('.heading', { hasText: 'Deep section' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Bookmark heading' }).click();
  await page.getByRole('tab', { name: 'Files' }).click();
  await expect(page.locator('.mark')).toHaveCount(2);

  // a heading bookmark opens its note at the heading
  await page.locator('.row[data-path="Beta.md"]').click();
  await page.locator('.mark', { hasText: 'Deep section' }).click();
  await expect(page.locator('.tabs .tab.active')).toContainText('Alpha');
  await expect(page.locator('.status')).toContainText('Ln 3,');
  await page.keyboard.press('ControlOrMeta+Shift+b'); // un-bookmarks the current file
  await expect(page.locator('.mark')).toHaveCount(1);

  // ⌘P: recently opened first, the current file last
  await page.keyboard.press('ControlOrMeta+p');
  await expect(page.getByRole('option').first()).toContainText('Beta');
  await page.keyboard.press('Escape');

  // pin Beta: it moves first, shows a pin instead of ×, and won't close by accident
  const names = page.locator('.tabs .tab .name');
  await page.locator('.tabs .tab', { hasText: 'Beta' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Pin tab' }).click();
  await expect(names).toHaveText(['Beta', 'Welcome', 'Alpha']);
  await page.locator('.tabs .tab', { hasText: 'Beta' }).click({ button: 'middle' });
  await expect(names).toHaveCount(3);

  // close a tab, reopen it from the tab menu
  await page.locator('.tabs .tab', { hasText: 'Welcome' }).getByRole('button', { name: 'Close tab' }).click();
  await expect(names).toHaveText(['Beta', 'Alpha']);
  await page.locator('.tabs .tab', { hasText: 'Alpha' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Reopen closed tab' }).click();
  await expect(names).toHaveText(['Beta', 'Alpha', 'Welcome']);

  // pins and bookmarks survive a reload
  await page.reload();
  await expect(names).toHaveText(['Beta', 'Alpha', 'Welcome']);
  await expect(page.locator('.tabs .tab', { hasText: 'Beta' }).getByRole('button', { name: 'Unpin tab' })).toHaveCount(1);
  await expect(page.locator('.mark')).toHaveText([/Deep section/]);
});
