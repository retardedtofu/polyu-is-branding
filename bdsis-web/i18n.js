/* Language controller. Loaded BLOCKING in <head> alongside theme.js so the
   stored language is applied before first paint.

   Translations live in zh.js as a dictionary keyed on each element's exact
   English innerHTML. Matching happens element by element against a real DOM —
   never by string replacement over the markup — so inline <strong> and <code>
   survive and no fragment can be translated by accident. A key absent from the
   dictionary simply stays in English, which is the safe failure. */
(() => {
  'use strict';
  const KEY = 'bdsis-lang';
  const LANGS = { en: 'EN', zh: '中文' };

  let current = 'en';
  try { const v = localStorage.getItem(KEY); if (v && LANGS[v]) current = v; } catch (e) {}

  const SEL = 'h1,h2,h3,h4,p,li,a,span,td,th,div,button,strong,figcaption,summary';
  let indexed = false;

  /* Tag every element whose full English text has a translation. Done once,
     on the English pass, so the keys are always read from the original. */
  const index = () => {
    const dict = window.ZH || {};
    document.querySelectorAll(SEL).forEach(el => {
      if (el.dataset.i18n !== undefined) return;
      const key = el.innerHTML.trim();
      if (!key || !(key in dict)) return;
      el.dataset.i18n = '';
      el.dataset.en = el.innerHTML;
      el.dataset.zh = dict[key];
    });
    document.querySelectorAll('[aria-label]').forEach(el => {
      if (el.dataset.enLabel !== undefined) return;
      const key = el.getAttribute('aria-label');
      if (!key || !(key in dict)) return;
      el.dataset.enLabel = key;
      el.dataset.zhLabel = dict[key];
    });
    indexed = true;
  };

  const swap = () => {
    if (!indexed) index();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const next = current === 'zh' ? el.dataset.zh : el.dataset.en;
      if (next !== undefined && el.innerHTML !== next) el.innerHTML = next;
    });
    document.querySelectorAll('[data-en-label]').forEach(el => {
      el.setAttribute('aria-label', current === 'zh' ? el.dataset.zhLabel : el.dataset.enLabel);
    });
  };

  const apply = persist => {
    const d = document.documentElement;
    d.lang = current === 'zh' ? 'zh-Hant' : 'en';
    d.dataset.lang = current;
    if (persist) { try { localStorage.setItem(KEY, current); } catch (e) {} }
    if (document.body) swap();
    document.querySelectorAll('.lang-bar button').forEach(b =>
      b.classList.toggle('on', b.dataset.lang === current));
    dispatchEvent(new CustomEvent('langchange', { detail: { lang: current } }));
  };
  apply(false);   // sets <html lang> before paint

  addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.className = 'lang-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Language / 語言');
    Object.entries(LANGS).forEach(([k, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.lang = k; b.textContent = label;
      b.setAttribute('lang', k === 'zh' ? 'zh-Hant' : 'en');
      b.addEventListener('click', () => { current = k; apply(true); });
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
    apply(false);
  });

  window.__lang = { get: () => current, set: l => { if (LANGS[l]) { current = l; apply(true); } } };
})();
