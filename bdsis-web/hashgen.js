/* The signature field generator.

   Drives the same pipeline the printed pieces use — cellhash.js, which is in
   turn a parity port of the Lab's generator — so a field composed here and a
   field printed on a card from the same text are the same artwork, cell for
   cell. Nothing here reimplements the hash; it only exposes its inputs.

   Cells can be overridden one at a time on top of what the hash chose. The
   hash still draws for every cell underneath, so an override never shifts the
   cells after it, and clearing one puts the hashed cell back. Changing the
   text throws the overrides away: the field belongs to the text first.

   Everything runs in the browser. The text never leaves the page: it is not
   sent anywhere, not logged and not stored, which is what makes it safe to
   type a student number into. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const host = $('sig-field');
  if (!host || !window.CellHash) return;

  const CH = window.CellHash;
  const text = $('sig-text'), cols = $('sig-cols'), rows = $('sig-rows');
  const tagOut = $('sig-tag'), sizeOut = $('sig-size'), grid = $('sig-cells');

  /* Millimetres per cell in the saved file. The lattice is unitless on screen;
     a printed field needs a real size, and 10 mm is the size the business-card
     reverse uses at its own scale. */
  const CELL = 10;
  const LIMIT = { cols: [2, 64], rows: [2, 64] };

  let lead = null, accent = null, pal = 'brand', last = null;

  /* Overrides are keyed by column and row rather than by cell index, so
     resizing the grid keeps each customised cell where it was put instead of
     sliding it along the lattice. */
  const overrides = new Map();
  const pick = { t: 'quarter', rot: 0, fam: 0 };

  const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, Math.round(v) || lo));

  /* ── the shape tools ──────────────────────────────────────────────────── */
  const U = CH.U || 100;
  const preview = (t, rot, fill) => {
    const g = `fill="${fill}"`;
    if (t === 'quarter') return `<path d="${CH.QUARTER(0, 0)[rot]}" ${g}/>`;
    if (t === 'split') return `<path d="M0,0 L${U},0 L0,${U} Z" ${g} opacity=".95"/>` +
      `<path d="M${U},0 L${U},${U} L0,${U} Z" ${g} opacity=".6"/>`;
    if (t === 'circle') return `<circle cx="${U / 2}" cy="${U / 2}" r="${U / 2}" ${g}/>`;
    if (t === 'square') return `<rect width="${U}" height="${U}" ${g}/>`;
    return `<rect width="${U}" height="${U}" fill="none" stroke="${fill}" ` +
      `stroke-width="6" stroke-dasharray="14 10"/>`;
  };

  const TOOLS = [
    { t: 'quarter', rot: 0, label: 'Quarter circle, bulging top left' },
    { t: 'quarter', rot: 1, label: 'Quarter circle, bulging bottom right' },
    { t: 'quarter', rot: 2, label: 'Quarter circle, bulging top right' },
    { t: 'quarter', rot: 3, label: 'Quarter circle, bulging bottom left' },
    { t: 'split', rot: 0, label: 'Split square' },
    { t: 'circle', rot: 0, label: 'Circle' },
    { t: 'square', rot: 0, label: 'Square' },
    { t: 'empty', rot: 0, label: 'Empty cell' },
    { t: 'clear', rot: 0, label: 'Clear the override and put the hashed cell back' },
  ];

  const shapeBar = $('sig-shape');
  if (shapeBar) {
    shapeBar.innerHTML = TOOLS.map((tool, i) =>
      `<button type="button" class="cellbtn${i === 0 ? ' on' : ''}" data-i="${i}"` +
      ` aria-pressed="${i === 0}" aria-label="${tool.label}" title="${tool.label}">` +
      `<svg viewBox="0 0 ${U} ${U}" aria-hidden="true">` +
      preview(tool.t === 'clear' ? 'empty' : tool.t, tool.rot, 'currentColor') +
      `</svg></button>`).join('');
    shapeBar.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const tool = TOOLS[+b.dataset.i];
      pick.t = tool.t; pick.rot = tool.rot;
      shapeBar.querySelectorAll('button').forEach(x => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
    });
  }

  const famBar = $('sig-cellfam');
  if (famBar) {
    famBar.innerHTML = CH.FAM.map((f, i) =>
      `<button type="button" data-fam="${i}"${i === 0 ? ' class="on" aria-pressed="true"' : ''}` +
      ` aria-label="${f.name}" title="${f.name}"><i style="background:${f.a}"></i></button>`).join('');
    famBar.addEventListener('click', e => {
      const b = e.target.closest('button[data-fam]');
      if (!b) return;
      pick.fam = +b.dataset.fam;
      famBar.querySelectorAll('button').forEach(x => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
    });
  }

  /* ── the clickable lattice ────────────────────────────────────────────── */
  function buildGrid(c, r) {
    if (!grid) return;
    if (grid.dataset.c === String(c) && grid.dataset.r === String(r)) return;
    grid.dataset.c = c; grid.dataset.r = r;
    grid.style.gridTemplateColumns = `repeat(${c}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${r}, 1fr)`;
    let html = '';
    for (let y = 0; y < r; y++) {
      for (let x = 0; x < c; x++) {
        html += `<button type="button" data-x="${x}" data-y="${y}" ` +
          `aria-label="Cell, column ${x + 1}, row ${y + 1}"></button>`;
      }
    }
    grid.innerHTML = html;
  }

  if (grid) grid.addEventListener('click', e => {
    const b = e.target.closest('button[data-x]');
    if (!b) return;
    const key = b.dataset.x + ',' + b.dataset.y;
    if (pick.t === 'clear') overrides.delete(key);
    else overrides.set(key, { t: pick.t, rot: pick.rot, fam: pick.fam });
    draw();
  });

  /* ── drawing ──────────────────────────────────────────────────────────── */
  function draw() {
    const c = clamp(+cols.value, LIMIT.cols), r = clamp(+rows.value, LIMIT.rows);
    buildGrid(c, r);

    /* Fold the column/row keys down to the flat index cellhash expects,
       dropping anything now outside the grid. */
    const over = {};
    let used = 0;
    overrides.forEach((v, k) => {
      const [x, y] = k.split(',').map(Number);
      if (x < c && y < r) { over[y * c + x] = v; used++; }
    });

    host.dataset.hash = text.value.trim() || ' ';
    host.dataset.hashCols = c;
    host.dataset.hashRows = r;
    host.dataset.hashPalette = pal;
    if (lead === null) delete host.dataset.hashLead; else host.dataset.hashLead = lead;
    if (accent === null) delete host.dataset.hashAccent; else host.dataset.hashAccent = accent;

    const res = CH.paint(host, over);
    /* The ratio goes on the stage, which is what both the artwork and the
       lattice are stretched to. */
    host.parentElement.style.aspectRatio = c + ' / ' + r;
    last = { c, r, res };

    if (grid) grid.querySelectorAll('button').forEach(b => {
      b.classList.toggle('is-custom', overrides.has(b.dataset.x + ',' + b.dataset.y));
    });

    const fam = CH.FAM;
    tagOut.textContent = res.tag;
    sizeOut.textContent = `${c} × ${r} cells · ${c * CELL} × ${r * CELL} mm at ` +
      `${CELL} mm · lead ${fam[res.lead].name} · accent ${fam[res.accent].name}` +
      (used ? ` · ${used} cell${used > 1 ? 's' : ''} customised` : '');
  }

  /* ── the other controls ───────────────────────────────────────────────── */
  const seg = (id, set) => {
    const bar = $(id);
    if (!bar) return;
    bar.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      set(b.dataset.v === 'auto' ? null : b.dataset.v);
      bar.querySelectorAll('button').forEach(x => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      draw();
    });
  };

  seg('sig-lead', v => { lead = v === null ? null : +v; });
  seg('sig-accent', v => { accent = v === null ? null : +v; });
  seg('sig-pal', v => { pal = v || 'brand'; });

  /* Changing the text regenerates from scratch. The field belongs to the text,
     so customisations made against the old one are not carried over. */
  text.addEventListener('input', () => { overrides.clear(); draw(); });
  [cols, rows].forEach(el => el.addEventListener('input', draw));

  const reset = $('sig-reset');
  if (reset) reset.addEventListener('click', () => { overrides.clear(); draw(); });

  /* ── output ─────────────────────────────────────────────────────────── */
  const fileSVG = () => {
    const svg = host.querySelector('svg').cloneNode(true);
    svg.setAttribute('width', last.c * CELL + 'mm');
    svg.setAttribute('height', last.r * CELL + 'mm');
    svg.removeAttribute('aria-hidden');
    svg.setAttribute('role', 'img');
    const t = document.createElement('title');
    t.textContent = 'Signature field · ' + (text.value.trim() || 'untitled') +
      ' · ' + last.res.tag;
    svg.insertBefore(t, svg.firstChild);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + svg.outerHTML + '\n';
  };

  const slug = s => (s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'signature').slice(0, 40);

  const flash = (btn, msg) => {
    const was = btn.dataset.was || (btn.dataset.was = btn.textContent);
    btn.textContent = msg;
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = was; }, 1600);
  };

  const save = $('sig-save'), copy = $('sig-copy');

  if (save) save.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([fileSVG()], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bdsis-signature-' + slug(text.value) + '-' + last.res.tag + '.svg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash(save, 'Saved');
  });

  if (copy) copy.addEventListener('click', async () => {
    const svg = fileSVG();
    let done = false;
    try { await navigator.clipboard.writeText(svg); done = true; } catch (e) { /* below */ }
    if (!done) {
      /* Left in place and selected when execCommand refuses, so that
         "Press ⌘C" is an instruction that can actually be followed. */
      const ta = document.createElement('textarea');
      ta.value = svg;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      if (done) ta.remove();
      else {
        ta.style.left = '0'; ta.style.opacity = '0.01';
        ta.addEventListener('blur', () => ta.remove(), { once: true });
        setTimeout(() => ta.remove(), 15000);
      }
    }
    flash(copy, done ? 'Copied' : 'Press ⌘C');
  });

  draw();
})();
