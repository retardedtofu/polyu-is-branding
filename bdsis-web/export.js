/* PDF export for the print artifacts.
   The browser's own print pipeline emits vector PDF, so this does not bundle a
   PDF library — it prepares the DOM and hands over to it. */
(() => {
  'use strict';

  const root = document.createElement('div');
  root.id = 'print-root';
  document.body.appendChild(root);

  /* Masked artwork rasterises.
     The mark and wordmark are drawn as CSS masks over `currentColor`, which is
     how one file serves black, white and gold on screen. Chrome flattens a
     masked element to a bitmap when printing, which would land in Illustrator
     as a pixel image instead of editable paths. So before printing, each
     masked element is swapped for a real <img> of the same SVG — inlined by
     the print pipeline as vector — and recoloured with a filter when the
     artwork needs to be light rather than black. */
  const LIGHT = c => {
    const n = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    if (n.length < 3) return false;
    const [r, g, b] = n.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
  };

  /* Ratios from the master artwork, relative to the mark height. */
  const BOX = {
    mark:     [1, 1],
    endorsed: [4.810, 0.808],   /* "PolyU / Interdisciplinary Studies" */
    standalone: [3.194, 0.726], /* "Interdisciplinary Studies"         */
  };

  const devectorise = scope => {
    scope.querySelectorAll('.af-logo__word, .af-logo--mono .af-logo__mark').forEach(el => {
      const cs = getComputedStyle(el);
      const url = cs.maskImage !== 'none' ? cs.maskImage : (cs.webkitMaskImage || '');
      const m = url.match(/url\(["']?([^"')]+)["']?\)/);
      if (!m) return;

      /* Size from --m (the mark height in mm) rather than from a computed
         width: the clone lives in a display:none container, where computed
         widths are 0. Expressing the box in em also means it stays correct
         when print resets the artifact's font-size to 1mm. */
      const lockup = el.closest('.af-logo');
      const mm = parseFloat(getComputedStyle(lockup).getPropertyValue('--m')) || 10;
      const isWord = el.classList.contains('af-logo__word');
      const ratio = isWord
        ? (lockup.classList.contains('af-logo--is') ? BOX.standalone : BOX.endorsed)
        : BOX.mark;

      const img = document.createElement('img');
      img.src = m[1];
      img.alt = '';
      img.style.cssText = 'display:block;flex-shrink:0;' +
        `width:${(mm * ratio[0]).toFixed(3)}em;height:${(mm * ratio[1]).toFixed(3)}em;`;
      /* The source artwork is black; invert it where it sits light. */
      if (LIGHT(cs.backgroundColor)) img.style.filter = 'invert(1)';
      el.replaceWith(img);
    });
  };

  /* Trim size in mm per piece, plus 3 mm bleed on every edge. */
  const PAGE = {
    'artifact--a4': [210, 297], 'artifact--card': [90, 54], 'artifact--id': [85.6, 54],
    'artifact--tag': [100, 55], 'artifact--panel': [850, 2000],
  };
  const sizeStyle = document.createElement('style');
  document.head.appendChild(sizeStyle);

  /* Named @page rules cover the mixed-size "export all" case, but support is
     patchier than a plain @page. When every page in the job is the same size —
     which is every single-piece export — declare it outright instead. */
  const setPageSize = artifacts => {
    const kinds = new Set(artifacts.map(a => [...a.classList].find(c => PAGE[c])));
    sizeStyle.textContent = '';
    if (kinds.size !== 1) return;
    const [w, h] = PAGE[[...kinds][0]];
    sizeStyle.textContent = `@page { size: ${w + 6}mm ${h + 6}mm; margin: 0; }`;
  };

  /* Cloning an inline SVG duplicates its gradient ids, and `url(#id)` then
     resolves to whichever comes first in the document — the ORIGINAL, which is
     display:none for the duration of the print. Renaming the clone's ids keeps
     each piece self-contained. */
  let idSeq = 0;
  const reidentify = scope => {
    scope.querySelectorAll('svg').forEach(svg => {
      const n = ++idSeq;
      svg.querySelectorAll('[id]').forEach(def => {
        const was = def.id, now = `p${n}${was}`;
        def.id = now;
        svg.querySelectorAll('[fill], [stroke]').forEach(el => {
          ['fill', 'stroke'].forEach(attr => {
            if (el.getAttribute(attr) === `url(#${was})`) el.setAttribute(attr, `url(#${now})`);
          });
        });
      });
    });
  };

  const exportPieces = artifacts => {
    if (!artifacts.length) return;
    root.textContent = '';
    setPageSize(artifacts);
    artifacts.forEach(a => {
      const clone = a.cloneNode(true);
      /* Freeze the on-screen scale: in print, font-size is reset to 1mm by
         CSS, and every child is in em, so the piece redraws at true size. */
      clone.style.fontSize = '';
      clone.style.width = '';
      root.appendChild(clone);
    });
    devectorise(root);
    reidentify(root);
    /* The pieces are edited in place, so the clone inherits the editing state.
       Artwork handed to a printer should carry none of it. */
    root.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });
    document.body.classList.add('is-exporting');
    /* Let layout settle before the print dialog samples it. */
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  const cleanup = () => {
    document.body.classList.remove('is-exporting');
    root.textContent = '';
    sizeStyle.textContent = '';
  };
  addEventListener('afterprint', cleanup);
  /* Safari fires no afterprint in some versions; fall back on focus return. */
  addEventListener('focus', () => { if (document.body.classList.contains('is-exporting')) setTimeout(cleanup, 300); });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-export]');
    if (!btn) return;
    const target = btn.dataset.export;
    const scope = target === 'all' ? document : document.getElementById(target);
    if (!scope) return;
    exportPieces([...scope.querySelectorAll('.artifact')]);
  });
})();
