<script lang="ts">
  import { Sun, Moon, Monitor, ChevronLeft, ChevronRight, Check } from '@lucide/svelte';
  import Panel from './Panel.svelte';
  import { app, type Settings } from '../lib/app.svelte';
  import { SCHEMES } from '../lib/schemes';

  let { onclose }: { onclose: () => void } = $props();

  const s = app.settings;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    app.settings[k] = v;
    app.saveSettings();
  };

  const presets: { id: Settings['preset']; label: string }[] = [
    { id: 'github', label: 'GitHub' },
    { id: 'academic', label: 'Academic' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'sepia', label: 'Sepia' },
  ];

  /** Step through a list with ‹ › and wrap around. */
  const step = <T,>(list: T[], cur: T, d: number) => list[(list.indexOf(cur) + d + list.length) % list.length];

  let schemesOpen = $state(false);
  const mode = $derived(app.dark ? 'dark' : 'light');
  const current = $derived(SCHEMES.find((x) => x.id === s.scheme) ?? SCHEMES[0]);

  // one slider, scoped to editor / both / preview (Figma-style linked value)
  const width = $derived(s.widthScope === 'editor' ? s.editorWidth : s.width);
  function setWidth(v: number) {
    if (s.widthScope !== 'preview') app.settings.editorWidth = v;
    if (s.widthScope !== 'editor') app.settings.width = v;
    app.saveSettings();
  }
  function setScope(sc: Settings['widthScope']) {
    // linking snaps both to the value currently shown, so "Both" never jumps
    if (sc === 'both') app.settings.editorWidth = app.settings.width = width;
    set('widthScope', sc);
  }
</script>

{#snippet swatch(sw: string[])}
  <span class="swatch" style="background:{sw[0]}">
    {#each sw.slice(1) as c, i (i)}<i style="background:{c}"></i>{/each}
  </span>
{/snippet}

<Panel title="Appearance" {onclose}>
  <div class="group">Text</div>

  <div class="row"><span class="label">Preview style</span></div>
  <div class="presets" role="radiogroup" aria-label="Preview style">
    {#each presets as p (p.id)}
      <button class="preset p-{p.id}" class:on={s.preset === p.id} role="radio" aria-checked={s.preset === p.id} aria-label={p.label} onclick={() => set('preset', p.id)}>
        <span class="sample">Aa</span>
        <span>{p.label}</span>
      </button>
    {/each}
  </div>

  {#if app.docStyle.preset || app.docStyle.font}
    <p class="hint own">This note sets its own {[app.docStyle.preset && 'style: ' + app.docStyle.preset, app.docStyle.font && 'font: ' + app.docStyle.font].filter(Boolean).join(', ')} in its front matter.</p>
  {/if}

  <div class="row">
    <span class="label">Font</span>
    <div class="seg">
      {#each [['preset', 'Auto'], ['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']] as [id, label] (id)}
        <button class:on={s.font === id} title={id === 'preset' ? "Use the preview style's font" : undefined} onclick={() => set('font', id as Settings['font'])}>{label}</button>
      {/each}
    </div>
  </div>

  <div class="row">
    <span class="label">Text size</span>
    <div class="slider">
      <input type="range" min="13" max="22" step="1" value={s.size} aria-label="Text size" oninput={(e) => set('size', +(e.currentTarget as HTMLInputElement).value)} />
      <output>{s.size}</output>
    </div>
  </div>

  <div class="row">
    <span class="label">Line width</span>
    <span class="mini-seg" role="radiogroup" aria-label="Line width applies to">
      {#each [['editor', 'Editor'], ['both', 'Both'], ['preview', 'Preview']] as [id, label] (id)}
        <button role="radio" aria-checked={s.widthScope === id} class:on={s.widthScope === id} onclick={() => setScope(id as Settings['widthScope'])}>{label}</button>
      {/each}
    </span>
  </div>
  <div class="slider full">
    <input type="range" min="480" max="1400" step="20" value={width} aria-label="Line width" oninput={(e) => setWidth(+(e.currentTarget as HTMLInputElement).value)} />
    <output>{width}</output>
  </div>

  <div class="group">Editor</div>

  <div class="row">
    <span class="label">Vim keys</span>
    <button class="switch" role="switch" aria-checked={s.vim} aria-label="Vim keys" onclick={() => set('vim', !s.vim)}><i></i></button>
  </div>

  <div class="group">Theme</div>

  <div class="row">
    <span class="label">Mode</span>
    <div class="seg icons">
      <button class:on={s.theme === 'system'} title="Follow system" aria-label="System" onclick={() => set('theme', 'system')}><Monitor size={13} /></button>
      <button class:on={s.theme === 'light'} title="Light" aria-label="Light" onclick={() => set('theme', 'light')}><Sun size={13} /></button>
      <button class:on={s.theme === 'dark'} title="Dark" aria-label="Dark" onclick={() => set('theme', 'dark')}><Moon size={13} /></button>
    </div>
  </div>

  <div class="row">
    <span class="label">Colors</span>
    <div class="stepper" role="group" aria-label="Color scheme">
      <button aria-label="Previous color scheme" onclick={() => set('scheme', step(SCHEMES, current, -1).id)}><ChevronLeft size={13} /></button>
      <button class="val scheme-val" aria-expanded={schemesOpen} aria-label="All color schemes: {current.name}" onclick={() => (schemesOpen = !schemesOpen)}>
        {@render swatch(current.swatch[mode])}{current.name}
      </button>
      <button aria-label="Next color scheme" onclick={() => set('scheme', step(SCHEMES, current, 1).id)}><ChevronRight size={13} /></button>
    </div>
  </div>
  {#if schemesOpen}
    <div class="schemes" role="listbox" aria-label="Color scheme">
      {#each SCHEMES as sc (sc.id)}
        <button class="scheme" class:on={sc.id === s.scheme} role="option" aria-selected={sc.id === s.scheme} onclick={() => set('scheme', sc.id)}>
          {@render swatch(sc.swatch[mode])}
          <span class="scheme-name">{sc.name}</span>
          {#if sc.id === s.scheme}<Check size={13} />{/if}
        </button>
      {/each}
    </div>
  {/if}
  <p class="hint">Colors apply to the app and editor; the preview keeps its style.</p>
</Panel>

<style>
  .group { margin: 2px 0 6px; font-size: 10.5px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: .05em; }
  .group:not(:first-child) { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 30px; margin-bottom: 6px; }
  .row.stack { flex-direction: column; align-items: stretch; gap: 4px; }
  .label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }

  /* shared compact control look: segmented, mini segmented, stepper */
  .seg, .stepper, .mini-seg { display: flex; padding: 2px; gap: 2px; border-radius: 7px; background: var(--bg-hover); }
  .seg button, .mini-seg button, .stepper button {
    display: inline-grid; place-items: center; height: 24px; padding: 0 8px; border: 0; border-radius: 5px;
    background: none; color: var(--text-muted); cursor: pointer; font-size: 11.5px; white-space: nowrap;
  }
  .seg.icons button { width: 30px; padding: 0; }
  .seg button:hover, .mini-seg button:hover, .stepper button:hover { color: var(--text); }
  .seg button.on, .mini-seg button.on { background: var(--bg-elevated); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / .1); }
  .mini-seg { padding: 1px; border-radius: 6px; }
  .mini-seg button { height: 18px; padding: 0 6px; font-size: 10.5px; border-radius: 4px; }
  .stepper { align-items: center; }
  .stepper > button:not(.val) { width: 22px; padding: 0; }
  .stepper .val {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 104px; height: 24px; padding: 0 8px;
    border-radius: 5px; background: var(--bg-elevated); color: var(--text); font-size: 11.5px; box-shadow: 0 1px 2px rgb(0 0 0 / .1);
  }
  /* preview styles: a type sample per preset (each tile shows its own typography) */
  .presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: -2px 0 8px; }
  .preset {
    display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0 6px; border: 1px solid var(--border);
    border-radius: 7px; background: var(--bg); color: var(--text-muted); cursor: pointer; font-size: 10.5px; min-width: 0;
  }
  .preset > span:last-child { max-width: 100%; padding: 0 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .preset:hover { border-color: var(--border-strong); color: var(--text); }
  .preset.on { border-color: var(--accent); color: var(--text); box-shadow: 0 0 0 1px var(--accent); }
  .sample { font-size: 18px; line-height: 1; color: var(--text); font-family: 'Inter Variable', Inter, sans-serif; }
  .p-academic .sample, .p-sepia .sample { font-family: 'Iowan Old Style', Charter, Georgia, serif; }
  .p-minimal .sample { font-weight: 300; }
  .p-sepia { background: #f8f1e3; color: #7a6650; }
  .p-sepia .sample { color: #3b2f22; }
  :global([data-theme='dark']) .p-sepia { background: #1e1913; color: #a8977f; }
  :global([data-theme='dark']) .p-sepia .sample { color: #e8dcc8; }

  .switch {
    position: relative; width: 30px; height: 18px; padding: 0; border: 0; border-radius: 9px; cursor: pointer;
    background: var(--border-strong); transition: background .15s;
  }
  .switch i { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / .25); transition: transform .15s; }
  .switch[aria-checked='true'] { background: var(--accent); }
  .switch[aria-checked='true'] i { transform: translateX(12px); }
  .slider { display: flex; align-items: center; gap: 8px; flex: 1; max-width: 150px; }
  .slider.full { max-width: none; margin: -2px 0 8px; }
  .slider output { min-width: 30px; text-align: right; font-size: 11px; color: var(--text-faint); font-variant-numeric: tabular-nums; }
  input[type='range'] { flex: 1; min-width: 0; margin: 0; accent-color: var(--accent); }

  .swatch {
    flex: none; display: grid; grid-template-columns: 5px 5px; gap: 2px; place-content: center; width: 18px; height: 18px;
    border-radius: 5px; box-shadow: inset 0 0 0 1px rgb(128 128 128 / .3);
  }
  .swatch i { width: 5px; height: 5px; border-radius: 50%; }
  .schemes {
    display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 4px; margin-bottom: 6px;
    border: 1px solid var(--border); border-radius: 9px; background: var(--bg); animation: pop .12s ease-out;
  }
  .scheme {
    display: flex; align-items: center; gap: 7px; padding: 4px 6px; border: 0; border-radius: 6px; background: none;
    color: var(--text-muted); cursor: pointer; font-size: 11.5px; text-align: left;
  }
  .scheme:hover { background: var(--bg-hover); color: var(--text); }
  .scheme.on { color: var(--text); background: var(--accent-soft); }
  .scheme :global(svg) { margin-left: auto; color: var(--accent); }
  .scheme-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hint.own { margin: -4px 0 8px; }
  .hint { margin: 2px 0 0; font-size: 11px; color: var(--text-faint); line-height: 1.5; }
</style>
