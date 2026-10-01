import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
export { expect };
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Persistent contexts: WebKit's ephemeral contexts have no OPFS. Fresh profile per test.
export const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({ playwright, browserName, baseURL, viewport }, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'mdr-'));
    const ctx = await playwright[browserName].launchPersistentContext(dir, { baseURL, viewport, acceptDownloads: true, serviceWorkers: 'block' });
    await use(ctx);
    await ctx.close();
    rmSync(dir, { recursive: true, force: true });
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage());
    // WebKit keeps OPFS outside the profile dir, so wipe it (from a non-app page on the same origin)
    await page.route('**/__blank__', (r) => r.fulfill({ body: '<!doctype html><title>blank</title>', contentType: 'text/html' }));
    await page.goto('/__blank__');
    await page.evaluate(async () => {
      localStorage.clear();
      const root = await navigator.storage.getDirectory();
      // @ts-ignore
      for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
    });
    await use(page);
  },
});


/**
 * The editor's document, from CodeMirror's state rather than the DOM: Live Preview hides markup, so `.cm-line` text
 * isn't the source. (`cmTile` is CodeMirror's DOM back-reference; the version is pinned by package-lock.)
 */
export const editorText = (page: Page) =>
  page.locator('.cm-content').evaluate((el: HTMLElement & { cmTile?: { view: { state: { doc: { toString(): string } } } } }) =>
    el.cmTile!.view.state.doc.toString(),
  );
