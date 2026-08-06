'use strict';
/* Site-wide theme control: palette (hue family) × mode (day/night), two
   independent axes. Loaded in <head> without defer so the stored choice applies
   before first paint, then the control bar is injected once <body> exists.
   Token values live in palettes.css, keyed html[data-palette][data-mode].
   Pages that draw their own colour (the Lab canvases) listen for `themechange`. */
(() => {
  const PALETTES = {
    'ink': '01 Ink & Paper',
    'scholar': '02 Midnight Scholar',
    'daylight': '03 Daylight Campus',
    'precision': '04 Precision Spectrum',
    'terra': '05 Terra',
    'mono-gold': '06 Mono Gold',
  };
  const DEFAULTS = { palette: 'terra', mode: 'day' };
  const KEY = { mode: 'islab-mode', palette: 'islab-palette' };
  const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const state = {
    mode: read(KEY.mode) === 'night' ? 'night' : 'day',
    palette: PALETTES[read(KEY.palette)] ? read(KEY.palette) : DEFAULTS.palette,
  };

  function apply(persist) {
    const d = document.documentElement.dataset;
    d.mode = state.mode;
    d.palette = state.palette;
    if (persist) { save(KEY.mode, state.mode); save(KEY.palette, state.palette); }
    document.querySelectorAll('.theme-bar [data-mode]')
      .forEach(b => b.classList.toggle('on', b.dataset.mode === state.mode));
    const sel = document.querySelector('.theme-bar select');
    if (sel && sel.value !== state.palette) sel.value = state.palette;
    dispatchEvent(new CustomEvent('themechange', { detail: { ...state } }));
  }

  apply(false);   // before first paint

  function build() {
    if (document.querySelector('.theme-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'theme-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Palette and day or night mode');

    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Colour palette');
    for (const [value, label] of Object.entries(PALETTES)) {
      const o = document.createElement('option');
      o.value = value; o.textContent = label;
      sel.appendChild(o);
    }
    sel.value = state.palette;
    sel.addEventListener('change', () => { state.palette = sel.value; apply(true); });
    bar.appendChild(sel);

    const seg = document.createElement('div');
    seg.className = 'theme-seg';
    for (const [label, mode] of [['Day', 'day'], ['Night', 'night']]) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.dataset.mode = mode;
      b.setAttribute('aria-label', label + ' mode');
      b.addEventListener('click', () => { state.mode = mode; apply(true); });
      seg.appendChild(b);
    }
    bar.appendChild(seg);
    document.body.appendChild(bar);
    apply(false);   // sync pressed state
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', build);
  else build();

  window.__theme = {
    get: () => ({ ...state }),
    set: patch => { Object.assign(state, patch); apply(true); },
    palettes: PALETTES,
  };
})();
