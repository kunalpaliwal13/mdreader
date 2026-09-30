<script lang="ts">
  import { Sun, Moon, Monitor } from '@lucide/svelte';
  import Panel from './Panel.svelte';
  import { app, type Settings } from '../lib/app.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const s = app.settings;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    app.settings[k] = v;
    app.saveSettings();
  };

  const presets: { id: Settings['preset']; label: string; sample: string }[] = [
    { id: 'github', label: 'GitHub', sample: 'Aa' },
    { id: 'academic', label: 'Academic', sample: 'Aa' },
    { id: 'minimal', label: 'Minimal', sample: 'Aa' },
    { id: 'sepia', label: 'Sepia', sample: 'Aa' },
  ];
</script>

<Panel title="Appearance" {onclose}>
  <div class="field">
    <span class="label">Theme</span>
    <div class="seg">
      <button class:on={s.theme === 'system'} onclick={() => set('theme', 'system')}><Monitor size={13} /> System</button>
      <button class:on={s.theme === 'light'} onclick={() => set('theme', 'light')}><Sun size={13} /> Light</button>
      <button class:on={s.theme === 'dark'} onclick={() => set('theme', 'dark')}><Moon size={13} /> Dark</button>
    </div>
  </div>

  <div class="field">
    <span class="label">Preview style</span>
    <div class="presets">
      {#each presets as p (p.id)}
        <button class="preset p-{p.id}" class:on={s.preset === p.id} onclick={() => set('preset', p.id)}>
          <span class="sample">{p.sample}</span>
          <span>{p.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="field">
    <span class="label">Font</span>
    <div class="seg">
      {#each [['preset', 'Style default'], ['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']] as [id, label] (id)}
        <button class:on={s.font === id} onclick={() => set('font', id as Settings['font'])}>{label}</button>
      {/each}
    </div>
  </div>

  <div class="field">
    <span class="label">Text size <em>{s.size}px</em></span>
    <input type="range" min="13" max="22" step="1" value={s.size} oninput={(e) => set('size', +(e.currentTarget as HTMLInputElement).value)} />
  </div>

  <div class="field">
    <span class="label">Line width <em>{s.width}px</em></span>
    <input type="range" min="560" max="1200" step="20" value={s.width} oninput={(e) => set('width', +(e.currentTarget as HTMLInputElement).value)} />
  </div>
</Panel>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .field:last-child { margin-bottom: 0; }
  .label { font-size: 11.5px; color: var(--text-muted); font-weight: 500; display: flex; justify-content: space-between; }
  .label em { font-style: normal; color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .seg { display: flex; padding: 2px; border-radius: 7px; background: var(--bg-hover); gap: 2px; }
  .seg button {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 26px; border: 0;
    border-radius: 5px; background: none; color: var(--text-muted); cursor: pointer; font-size: 12px; white-space: nowrap; padding: 0 4px;
  }
  .seg button.on { background: var(--bg-elevated); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
  .presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .preset {
    display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0 6px; border: 1px solid var(--border);
    border-radius: 7px; background: var(--bg); color: var(--text-muted); cursor: pointer; font-size: 11px;
  }
  .preset.on { border-color: var(--accent); color: var(--text); box-shadow: 0 0 0 1px var(--accent); }
  .sample { font-size: 18px; line-height: 1; color: var(--text); }
  .p-academic .sample, .p-sepia .sample { font-family: 'Iowan Old Style', Charter, Georgia, serif; }
  .p-minimal .sample { font-weight: 300; }
  .p-sepia { background: #f8f1e3; }
  .p-sepia .sample { color: #3b2f22; }
  .p-sepia span:last-child { color: #7a6650; }
  input[type='range'] { width: 100%; accent-color: var(--accent); }
</style>
