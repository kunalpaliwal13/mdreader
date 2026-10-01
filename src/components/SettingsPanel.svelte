<script lang="ts">
  import { Sun, Moon, Monitor, ChevronDown, Check } from '@lucide/svelte';
  import { SCHEMES } from '../lib/schemes';
  import Panel from './Panel.svelte';
  import { app, type Settings } from '../lib/app.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const s = app.settings;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    app.settings[k] = v;
    app.saveSettings();
  };

  let schemesOpen = $state(false);
  const mode = $derived(app.dark ? 'dark' : 'light');
  const current = $derived(SCHEMES.find((x) => x.id === s.scheme) ?? SCHEMES[0]);

  const presets: { id: Settings['preset']; label: string; sample: string }[] = [
    { id: 'github', label: 'GitHub', sample: 'Aa' },
    { id: 'academic', label: 'Academic', sample: 'Aa' },
    { id: 'minimal', label: 'Minimal', sample: 'Aa' },
    { id: 'sepia', label: 'Sepia', sample: 'Aa' },
  ];
</script>

{#snippet swatch(sw: string[])}
    <span class="swatch" style="background:{sw[0]}">
      {#each sw.slice(1) as c, i (i)}<i style="background:{c}"></i>{/each}
    </span>
  {/snippet}

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
    <span class="label">Color scheme <em>app &amp; editor</em></span>
    <button class="scheme-btn" aria-expanded={schemesOpen} onclick={() => (schemesOpen = !schemesOpen)}>
      {@render swatch(current.swatch[mode])}
      <span class="scheme-name">{current.name}</span>
      <span class="chev" class:open={schemesOpen}><ChevronDown size={14} /></span>
    </button>
    {#if schemesOpen}
      <div class="schemes" role="listbox" aria-label="Color scheme">
        {#each SCHEMES as sc (sc.id)}
          <button
            class="scheme"
            class:on={sc.id === s.scheme}
            role="option"
            aria-selected={sc.id === s.scheme}
            onclick={() => set('scheme', sc.id)}
          >
            {@render swatch(sc.swatch[mode])}
            <span class="scheme-name">{sc.name}</span>
            {#if sc.id === s.scheme}<Check size={14} />{/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="group">Preview</div>

  <div class="field">
    <span class="label">Style</span>
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
    <input type="range" min="560" max="1200" step="20" value={s.width} aria-label="Preview line width" oninput={(e) => set('width', +(e.currentTarget as HTMLInputElement).value)} />
  </div>

  <div class="group">Editor</div>

  <div class="field">
    <span class="label">Line width <em>{s.editorWidth}px</em></span>
    <input type="range" min="480" max="1400" step="20" value={s.editorWidth} aria-label="Editor line width" oninput={(e) => set('editorWidth', +(e.currentTarget as HTMLInputElement).value)} />
  </div>
</Panel>

<style>
  .scheme-btn, .scheme {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 5px 8px 5px 5px; border-radius: 8px;
    background: none; color: var(--text); cursor: pointer; text-align: left; font-size: 12.5px;
  }
  .scheme-btn { border: 1px solid var(--border-strong); background: var(--bg); }
  .scheme-btn:hover, .scheme:hover { background: var(--bg-hover); }
  .scheme { border: 0; color: var(--text-muted); }
  .scheme.on { color: var(--text); font-weight: 550; }
  .scheme :global(svg) { color: var(--accent); }
  .scheme-name { flex: 1; }
  .chev { display: inline-grid; color: var(--text-faint); transition: transform .15s; }
  .chev.open { transform: rotate(180deg); }
  .schemes { display: flex; flex-direction: column; gap: 1px; padding: 4px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); animation: pop .12s ease-out; }
  .swatch {
    flex: none; display: grid; grid-template-columns: 7px 7px; gap: 3px; place-content: center; width: 26px; height: 26px;
    border-radius: 7px; box-shadow: inset 0 0 0 1px rgb(128 128 128 / .25);
  }
  .swatch i { width: 7px; height: 7px; border-radius: 50%; }
  .group { margin: 4px 0 8px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: .04em; }
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
