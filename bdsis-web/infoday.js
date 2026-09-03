/* The Info Day card maker.

   One card, drawn by the same pipeline as the print artifacts: cellhash.js
   lays out the field from the visitor's name, and svgexport.js serialises the
   piece at true size. Nothing here reimplements either. This file only binds
   the form to the card, sends the card to the printer at CR80 size, and
   prints a list of names as a batch.

   Everything runs in the browser. The name never leaves the page: it is not
   sent anywhere, not logged and not stored. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const host = $('mk-hash'), card = $('mk-card');
  if (!host || !card || !window.CellHash) return;

  const CH = window.CellHash;
  const nameIn = $('mk-name'), initialsIn = $('mk-initials'), areaIn = $('mk-area');
  const styleBar = $('mk-style');
  const cardName = $('mk-card-name'), cardLine = $('mk-card-line'), cardMeta = $('mk-card-meta');
  const caption = $('mk-caption');
  const btns = { svg: $('mk-svg'), print: $('mk-print') };

  /* The event, as it is set on the card. */
  const EVENT = 'Info Day 10.10.2026';

  /* Areas of interest, each mapped to the family that leads the field.
     The brand has four families and no others, so every area takes one of
     the four slots: 0 Red, 1 Tangerine, 2 Olive, 3 Ocean. The grouping below
     is a first pass; the College is to confirm which tone each faculty takes
     for the day, and that is a one-line change here. */
  const AREAS = [
    { label: 'Business',                     fam: 0 },
    { label: 'Hotel and Tourism',            fam: 0 },
    { label: 'Design',                       fam: 1 },
    { label: 'Fashion and Textiles',         fam: 1 },
    { label: 'Humanities',                   fam: 1 },
    { label: 'Health and Social Sciences',   fam: 2 },
    { label: 'Construction and Environment', fam: 2 },
    { label: 'Engineering',                  fam: 3 },
    { label: 'Science',                      fam: 3 },
    { label: 'Computing and Mathematics',    fam: 3 },
  ];
  AREAS.forEach((a, i) => {
    const o = document.createElement('option');
    o.value = String(i); o.textContent = a.label;
    areaIn.appendChild(o);
  });

  /* Lettering: which pixel face writes the initials, and at what density.
     Fine is the 5 x 7 dot face on a 2x lattice, as the business card sets it;
     Bold is the 3 x 5 face on the 1x lattice, where each letter is three
     cells of 4.28 mm. None leaves the field entirely to the hash. */
  const STYLES = {
    fine: { font: 'dot',   density: 2 },
    bold: { font: 'micro', density: 1 },
    none: null,
  };
  let style = 'fine';

  /* Initials from the name: the first letter of each word, honorifics
     dropped, at most three. Only Latin letters can be set in the pixel
     faces, so a name with none leaves the field to the hash. */
  const HONORIFIC = /^(prof|professor|dr|mr|mrs|ms|miss|mx|sir|ir|eng)\.?$/i;
  const initialsOf = name => name.split(/[\s\-–·,]+/)
    .filter(w => w && !HONORIFIC.test(w))
    .map(w => (w.match(/[A-Za-z]/) || [''])[0].toUpperCase())
    .filter(Boolean).slice(0, 3).join('');

  /* The initials follow the name until the visitor edits them by hand. */
  let initialsTouched = false;

  /* Each line shrinks to its column rather than running under the lockup.
     data-fit carries the line's set size and its floor, in em, which inside
     an artifact means millimetres, so the fit holds at every on-screen scale
     and in every export. */
  const fitLines = () => {
    card.querySelectorAll('[data-fit]').forEach(el => {
      const [max, min] = el.dataset.fit.split(' ').map(Number);
      const box = el.parentElement;
      let fs = max;
      el.style.fontSize = fs + 'em';
      while (el.scrollWidth > box.clientWidth + 0.5 && fs > min) {
        fs = Math.round((fs - 0.1) * 10) / 10;
        el.style.fontSize = fs + 'em';
      }
    });
  };

  const slug = s => (s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'visitor').slice(0, 40);

  let last = { name: '', tag: '' };

  function draw() {
    const name = nameIn.value.trim();
    const initials = initialsIn.value.trim().toUpperCase();
    const area = areaIn.value === '' ? null : AREAS[+areaIn.value];

    host.dataset.hash = name || ' ';
    if (area) host.dataset.hashLead = area.fam; else delete host.dataset.hashLead;

    const st = STYLES[style];
    host.dataset.hashDensity = st ? st.density : 1;
    if (st && initials) {
      host.dataset.hashPixel = initials;
      host.dataset.hashPixelFont = st.font;
    } else {
      delete host.dataset.hashPixel;
      delete host.dataset.hashPixelFont;
    }

    const res = CH.paint(host);
    last = { name, tag: res.tag };

    cardName.textContent = name || 'Your name';
    cardName.style.color = name ? '#14110E' : '#8A8274';
    cardLine.textContent = area ? area.label : 'Interdisciplinary Studies · JS3000';
    cardMeta.textContent = EVENT + ' · Mark ' + res.tag;
    fitLines();

    const fam = CH.FAM;
    caption.textContent = '85.6 × 54 mm · CR80 card · ' +
      fam[res.lead].name + ' with ' + fam[res.accent].name + ' · Mark ' + res.tag;

    Object.values(btns).forEach(b => { if (b) b.disabled = !name; });
  }

  nameIn.addEventListener('input', () => {
    if (!initialsTouched) initialsIn.value = initialsOf(nameIn.value);
    draw();
  });
  initialsIn.addEventListener('input', () => {
    initialsTouched = initialsIn.value.trim() !== '';
    draw();
  });
  areaIn.addEventListener('change', draw);
  styleBar.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    style = b.dataset.v;
    styleBar.querySelectorAll('button').forEach(x => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    draw();
  });

  /* ── output ─────────────────────────────────────────────────────────── */
  const flash = (btn, msg) => {
    const was = btn.dataset.was || (btn.dataset.was = btn.textContent);
    btn.textContent = msg;
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = was; }, 1600);
  };

  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* The piece, serialised by the same exporter the artifacts page uses:
     true millimetres, the bleed ring in the ground colour, and the three
     guide layers. */
  btns.svg.addEventListener('click', async () => {
    const btn = btns.svg;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.dataset.was = btn.dataset.was || btn.textContent;
    btn.textContent = 'Saving';
    try {
      const svg = await window.BDSIS.artifactSVG(card);
      download(new Blob([svg], { type: 'image/svg+xml' }),
        'polyu-infoday-' + slug(last.name) + '-' + last.tag + '.svg');
      flash(btn, 'Saved');
    } catch (e) { console.error(e); flash(btn, 'Could not save'); }
    finally { btn.disabled = false; }
  });

  /* ── printing ──────────────────────────────────────────────────────────
     export.js clones the card into its print root and hands it to the
     browser. It sets every piece up with 3 mm of bleed; a card printer
     wants none. The Evolis driver takes a CR80 page of exactly 85.6 x 54 mm
     and carries the ink to the edge itself, so this page redeclares the
     ID-1 page at trim and drops the bleed margin. The rules land after
     export.js's own in the cascade, which is what makes them win. */
  document.body.classList.add('print-trim');
  const pageStyle = document.createElement('style');
  pageStyle.textContent = '@page id-piece { size: 85.6mm 54mm; margin: 0; }';
  document.head.appendChild(pageStyle);

  /* Enter in the name prints: with the browser in kiosk printing mode that
     is the whole loop, type and Enter. */
  nameIn.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!btns.print.disabled) btns.print.click(); }
  });

  /* After a single card prints, the form clears for the next visitor. The
     batch list is left standing, since a jammed card is reprinted from it. */
  let printing = null;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-export]');
    if (b) printing = b.dataset.export;
  });
  addEventListener('afterprint', () => {
    if (printing === 'maker') {
      nameIn.value = ''; initialsIn.value = ''; initialsTouched = false;
      draw();
      nameIn.focus();
    }
    printing = null;
  });

  /* ── batch ─────────────────────────────────────────────────────────────
     A list of names, one card each, drawn off screen by cloning the live
     card so the two can never disagree. Each clone is painted with the
     settings in force and its own initials, then fitted like the original.
     export.js prints everything inside the pile, one page per card. */
  const batchIn = $('mk-batch-names'), pile = $('mk-batch');
  const batchBtn = $('mk-batch-print'), batchCount = $('mk-batch-count');

  const fitIn = root => root.querySelectorAll('[data-fit]').forEach(el => {
    const [max, min] = el.dataset.fit.split(' ').map(Number);
    const box = el.parentElement;
    let fs = max;
    el.style.fontSize = fs + 'em';
    while (el.scrollWidth > box.clientWidth + 0.5 && fs > min) {
      fs = Math.round((fs - 0.1) * 10) / 10;
      el.style.fontSize = fs + 'em';
    }
  });

  function drawBatch() {
    if (!batchIn || !pile) return;
    const names = batchIn.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    const area = areaIn.value === '' ? null : AREAS[+areaIn.value];
    const st = STYLES[style];
    pile.textContent = '';
    names.forEach((name, i) => {
      const c = card.cloneNode(true);
      c.removeAttribute('id');
      const h = c.querySelector('.af-field');
      h.id = 'mk-batch-hash-' + i;
      c.querySelectorAll('[id]').forEach(el => { if (el !== h) el.removeAttribute('id'); });
      const line = c.querySelector('[data-hash-ink]');
      line.dataset.hashInk = h.id;
      const nm = c.querySelector('[data-fit^="3.2"]');
      const meta = c.querySelector('[data-fit="1.6 1.2"]');
      pile.appendChild(c);

      h.dataset.hash = name;
      if (area) h.dataset.hashLead = area.fam; else delete h.dataset.hashLead;
      h.dataset.hashDensity = st ? st.density : 1;
      const ini = initialsOf(name);
      if (st && ini) { h.dataset.hashPixel = ini; h.dataset.hashPixelFont = st.font; }
      else { delete h.dataset.hashPixel; delete h.dataset.hashPixelFont; }
      const res = CH.paint(h);
      nm.textContent = name; nm.style.color = '#14110E';
      line.textContent = area ? area.label : 'Interdisciplinary Studies · JS3000';
      meta.textContent = EVENT + ' · Mark ' + res.tag;
      fitIn(c);
    });
    const n = names.length;
    batchCount.textContent = n ? n + (n === 1 ? ' card ready' : ' cards ready') : 'No names yet';
    batchBtn.disabled = !n;
  }

  if (batchIn) {
    let t = null;
    batchIn.addEventListener('input', () => { clearTimeout(t); t = setTimeout(drawBatch, 150); });
    areaIn.addEventListener('change', drawBatch);
    styleBar.addEventListener('click', drawBatch);
  }

  initialsIn.value = '';
  draw();

  window.BDSIS = Object.assign(window.BDSIS || {}, { infoday: { draw, drawBatch, initialsOf } });
})();
