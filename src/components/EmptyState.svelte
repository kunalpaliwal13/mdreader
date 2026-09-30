<script lang="ts">
  import { FilePlus, Import } from '@lucide/svelte';
  import { app } from '../lib/app.svelte';
  import { importPicker } from '../lib/transfer';

  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
</script>

<div class="empty">
  <div class="card">
    <h2>No file open</h2>
    <p>Pick a file from the sidebar, start a new one, or drop markdown files and folders anywhere.</p>
    <div class="actions">
      <button class="btn primary" onclick={() => app.createFile('')}><FilePlus size={14} /> New file</button>
      <button class="btn" onclick={() => importPicker('files')}><Import size={14} /> Import</button>
    </div>
    <dl class="keys">
      <dt>{mod} \</dt><dd>Toggle sidebar</dd>
      <dt>{mod} E</dt><dd>Cycle edit / split / preview</dd>
      <dt>{mod} S</dt><dd>Save now</dd>
      <dt>{mod} B · I · K</dt><dd>Bold · italic · link</dd>
      <dt>F2</dt><dd>Rename in tree</dd>
    </dl>
  </div>
</div>

<style>
  .empty { height: 100%; display: grid; place-items: center; padding: 24px; }
  .card { max-width: 380px; text-align: center; }
  h2 { margin: 0 0 6px; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0 0 18px; color: var(--text-muted); line-height: 1.6; }
  .actions { display: flex; gap: 8px; justify-content: center; margin-bottom: 28px; }
  .keys { display: grid; grid-template-columns: auto auto; gap: 6px 16px; justify-content: center; margin: 0; font-size: 12px; color: var(--text-faint); text-align: left; }
  dt { font-family: var(--mono); font-size: 11px; color: var(--text-muted); text-align: right; }
  dd { margin: 0; }
</style>
