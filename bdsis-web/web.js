/* BDSIS web — the small amount of behaviour the design system needs.
   No dependencies. Everything degrades to a static page without JS. */
(() => {
  'use strict';

  /* ── Hero carousel ─────────────────────────────────────────────────────── */
  const hero = document.querySelector('[data-carousel]');
  if (hero) {
    const slides = [...hero.querySelectorAll('.hero__slide')];
    const dots   = [...hero.querySelectorAll('.hero__dot')];
    const toggle = hero.querySelector('[data-playpause]');
    const INTERVAL = 7000;
    let i = 0, timer = null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const show = n => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
    };
    const play = () => {
      if (reduced || timer) return;
      timer = setInterval(() => show(i + 1), INTERVAL);
      if (toggle) { toggle.textContent = '❚❚'; toggle.setAttribute('aria-label', 'Pause carousel'); }
    };
    const pause = () => {
      clearInterval(timer); timer = null;
      if (toggle) { toggle.textContent = '▶'; toggle.setAttribute('aria-label', 'Play carousel'); }
    };

    dots.forEach((d, k) => d.addEventListener('click', () => { show(k); pause(); }));
    if (toggle) toggle.addEventListener('click', () => (timer ? pause() : play()));
    hero.addEventListener('mouseenter', () => timer && clearInterval(timer));
    hero.addEventListener('mouseleave', () => { if (timer) { clearInterval(timer); timer = setInterval(() => show(i + 1), INTERVAL); } });

    if (!reduced) play(); else pause();
  }

  /* ── Stat counters ─────────────────────────────────────────────────────
     Count up once, when the number first scrolls into view.               */
  const stats = document.querySelectorAll('[data-count]');
  if (stats.length && 'IntersectionObserver' in window) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const target = parseInt(e.target.dataset.count, 10);
        if (reduced || !Number.isFinite(target)) { e.target.textContent = target; return; }
        const DUR = 900, t0 = performance.now();
        const step = now => {
          const p = Math.min(1, (now - t0) / DUR);
          e.target.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    stats.forEach(s => io.observe(s));
  }

  /* ── Primary navigation ────────────────────────────────────────────────
     Pure CSS :hover + :focus-within left a panel stuck open: clicking a nav
     link parks focus inside it, so the panel stayed until you clicked away,
     and a second panel could open alongside the first. Owning the state here
     guarantees exactly one panel is open, whatever the input device.       */
  const navItems = [...document.querySelectorAll('.nav__item')].filter(i => i.querySelector('.nav__panel'));
  if (navItems.length) {
    let closeTimer = null;
    const openOnly = item => {
      clearTimeout(closeTimer);
      navItems.forEach(i => i.classList.toggle('is-open', i === item));
    };
    const closeAll = () => navItems.forEach(i => i.classList.remove('is-open'));
    /* A small grace period so a diagonal mouse path between the link and its
       panel does not snap the panel shut mid-travel. */
    const closeSoon = () => { clearTimeout(closeTimer); closeTimer = setTimeout(closeAll, 140); };

    navItems.forEach(item => {
      item.addEventListener('mouseenter', () => openOnly(item));
      item.addEventListener('mouseleave', closeSoon);
      /* Keyboard: open on focus, but only for real keyboard traversal — a
         mouse click should not leave the panel hanging. */
      item.addEventListener('focusin', e => {
        if (e.target.matches(':focus-visible')) openOnly(item);
      });
      item.addEventListener('focusout', e => {
        if (!item.contains(e.relatedTarget)) closeSoon();
      });
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
    document.addEventListener('click', e => { if (!e.target.closest('.nav__item')) closeAll(); });
  }

  /* ── Guidelines: table of contents highlighting ────────────────────────── */
  const toc = document.querySelector('.doc-toc');
  if (toc && 'IntersectionObserver' in window) {
    const links = [...toc.querySelectorAll('a')];
    const targets = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.style.color = '');
        const active = links.find(a => a.getAttribute('href') === '#' + e.target.id);
        if (active) active.style.color = 'var(--is-crimson-ink)';
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    targets.forEach(t => io.observe(t));
  }

  /* ── Guidelines: make §NN cross-references clickable ────────────────────
     The section number is authored as plain text so the prose stays readable
     in source and in translation. Resolve it to the matching section here.

     This must re-run after every language switch: i18n restores innerHTML
     from the stored original, which discards any links added afterwards. */
  const sections = [...document.querySelectorAll('section[id]')];
  if (sections.length) {
    const byNumber = {};
    sections.forEach(sec => {
      const n = sec.querySelector(':scope > .eyebrow');
      if (n && /^\d+$/.test(n.textContent.trim())) byNumber[n.textContent.trim()] = sec.id;
    });

    const linkify = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!/§\s?\d{1,2}/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          /* Never touch code samples, existing links, or the nav. */
          if (node.parentElement.closest('a, code, pre, .doc-toc, .nav')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const targets = [];
      while (walker.nextNode()) targets.push(walker.currentNode);
      targets.forEach(node => {
        const frag = document.createDocumentFragment();
        let last = 0;
        node.nodeValue.replace(/§\s?(\d{1,2})/g, (match, num, i) => {
          const id = byNumber[num.padStart(2, '0')] || byNumber[num];
          if (!id) return match;
          if (i > last) frag.appendChild(document.createTextNode(node.nodeValue.slice(last, i)));
          const a = document.createElement('a');
          a.className = 'xref';
          a.href = '#' + id;
          a.textContent = match;
          frag.appendChild(a);
          last = i + match.length;
          return match;
        });
        if (!frag.childNodes.length) return;
        if (last < node.nodeValue.length) frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    };

    /* Order matters: i18n indexes each element's original innerHTML to build
       its translation keys. If linkify ran first, those keys would contain the
       injected <a> and would no longer match the dictionary. i18n.js is loaded
       in <head>, so its DOMContentLoaded listener is registered — and fires —
       before this one. */
    addEventListener('DOMContentLoaded', linkify);
    addEventListener('langchange', () => requestAnimationFrame(linkify));
  }

  /* ── Guidelines: every value on a colour card is copyable ──────────────
     Hex, CMYK and the ink each carry their own `data-copy`, because a
     designer wants one of the three, not the card. The label swaps to
     "copied" and swaps back; the original text is parked on the element so
     a second click during the timeout cannot capture the placeholder. */
  /* The async clipboard refuses without user activation and on an unfocused
     document, so fall back to a selection copy, and report either way. A
     silent no-op is the one outcome a copy control must never have. */
  const toClipboard = text => {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    }
    return legacyCopy(text);
  };
  const legacyCopy = text => new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    ok ? resolve() : reject(new Error('copy refused'));
  });

  document.querySelectorAll('[data-copy]').forEach(el => {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    const flash = (label, cls) => {
      if (el.dataset.was === undefined) el.dataset.was = el.innerHTML;
      el.innerHTML = label;
      el.classList.add(cls);
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        el.innerHTML = el.dataset.was;
        delete el.dataset.was;
        el.classList.remove('is-copied', 'is-failed');
      }, 1100);
    };
    const fire = () => toClipboard(el.dataset.copy)
      .then(() => flash('copied', 'is-copied'),
            () => flash('press ⌘C', 'is-failed'));
    el.addEventListener('click', e => { e.stopPropagation(); fire(); });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
    });
  });



/* ── Guidelines: the rasterised-logo counter-example ──────────────────────
   Drawn rather than faked. The lockup is rendered into a canvas a few pixels
   tall and then blown up with smoothing off, which is exactly what a printer
   receives when someone sends a small PNG: stepped edges and gradients that
   collapse into flat bands. */
document.querySelectorAll('canvas[data-raster]').forEach(cv => {
  const H = parseFloat(cv.dataset.raster) || 34;   // display height, in px
  const SRC = [
    { src: 'assets/mark-colour.svg',      w: 1,     h: 1 },
    { src: 'assets/wordmark-polyu-is.svg', w: 4.810, h: 0.808 },
  ];
  const GAP = 0.266, LOW = 6;      // LOW = pixels of real resolution, vertically
  const scale = H / LOW;
  const wTotal = SRC[0].w + GAP + SRC[1].w;
  cv.width  = Math.round(wTotal * LOW);
  cv.height = Math.round(LOW);
  cv.style.width  = Math.round(wTotal * H) + 'px';
  cv.style.height = H + 'px';
  cv.style.imageRendering = 'pixelated';
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let x = 0;
  SRC.forEach(part => {
    const img = new Image();
    const at = x;
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, at * LOW, (LOW - part.h * LOW) / 2, part.w * LOW, part.h * LOW);
    };
    img.src = part.src;
    x += part.w + GAP;
  });
});

})();
