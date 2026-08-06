/* Theme controller. Loaded BLOCKING in <head> so the stored theme is applied
   before first paint — a flash of the wrong ground is worse than a few ms. */
(() => {
  'use strict';
  const KEY = 'bdsis-theme';
  const THEMES = { light: 'Light', dark: 'Dark', 'dark-mono-gold': 'Dark Mono Gold' };

  let current = 'light';
  try { const v = localStorage.getItem(KEY); if (v && THEMES[v]) current = v; } catch (e) { /* private mode */ }

  const apply = persist => {
    document.documentElement.dataset.theme = current;
    if (persist) { try { localStorage.setItem(KEY, current); } catch (e) {} }
    document.querySelectorAll('.theme-bar button').forEach(b =>
      b.classList.toggle('on', b.dataset.theme === current));
    dispatchEvent(new CustomEvent('themechange', { detail: { theme: current } }));
  };
  apply(false);   // before paint

  addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.className = 'theme-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Colour theme');
    Object.entries(THEMES).forEach(([k, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.theme = k; b.textContent = label;
      b.addEventListener('click', () => { current = k; apply(true); });
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
    apply(false);
  });

  window.__theme = { get: () => current, set: t => { if (THEMES[t]) { current = t; apply(true); } } };
})();
