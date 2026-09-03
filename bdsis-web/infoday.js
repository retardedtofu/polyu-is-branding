/* The Info Day card maker.

   One card, drawn by the same pipeline as the print artifacts: cellhash.js
   lays out the field from the visitor's name, and svgexport.js serialises the
   piece at true size. Nothing here reimplements either. This file only binds
   the form to the card and turns the exported SVG into the raster a PVC card
   printer wants.

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
  const btns = { png: $('mk-png'), jpg: $('mk-jpg'), svg: $('mk-svg'), print: $('mk-print') };

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
     Bold is the 3 x 5 face on the documented 1x lattice, where each letter is
     three cells of 5.35 mm. None leaves the field entirely to the hash. */
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

  const fileBase = () => 'polyu-infoday-' + slug(last.name) + '-' + last.tag;

  /* The piece, serialised by the same exporter the artifacts page uses:
     true millimetres, the bleed ring in the ground colour, and the three
     guide layers. */
  const pieceSVG = () => window.BDSIS.artifactSVG(card);

  /* Trim and bleed in millimetres, as svgexport draws them, and the pixel
     size a CR80 card is at 300 dpi: 3.375 x 2.125 inches, which every card
     printer's software rounds to 1012 x 638. */
  const TRIM = [85.6, 54], BLEED = 3, CR80_PX = [1012, 638];

  /* The raster a card printer takes: the trim area alone, at 300 dpi. The
     exported SVG is parsed, its guide layers dropped, and its intrinsic size
     set to the target pixel size before it is drawn, so every browser
     rasterises the vector at that resolution instead of scaling a small
     bitmap up. The bleed ring is drawn off the canvas, which leaves exactly
     the trim, corner to corner, with the ground colour into the corners. */
  async function raster(type) {
    const doc = new DOMParser().parseFromString(await pieceSVG(), 'image/svg+xml');
    ['Bleeding', 'Cutting', 'Safety'].forEach(id => {
      const g = doc.getElementById(id); if (g) g.remove();
    });
    const sx = CR80_PX[0] / TRIM[0], sy = CR80_PX[1] / TRIM[1];   /* px per mm */
    const full = [(TRIM[0] + 2 * BLEED) * sx, (TRIM[1] + 2 * BLEED) * sy];
    const root = doc.documentElement;
    root.setAttribute('width', full[0]);
    root.setAttribute('height', full[1]);

    const blob = new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = CR80_PX[0];
      cv.height = CR80_PX[1];
      const ctx = cv.getContext('2d');
      /* JPEG has no alpha: paint the paper first so nothing lands black. */
      ctx.fillStyle = '#F8F2E7';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, -BLEED * sx, -BLEED * sy, full[0], full[1]);
      return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('toBlob')),
        type, type === 'image/jpeg' ? 0.95 : undefined));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const run = async (btn, job) => {
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    try { await job(); flash(btn, 'Saved'); }
    catch (e) { console.error(e); flash(btn, 'Failed'); }
    finally { btn.disabled = false; }
  };

  btns.png.addEventListener('click', () => run(btns.png, async () =>
    download(await raster('image/png'), fileBase() + '.png')));
  btns.jpg.addEventListener('click', () => run(btns.jpg, async () =>
    download(await raster('image/jpeg'), fileBase() + '.jpg')));
  btns.svg.addEventListener('click', () => run(btns.svg, async () =>
    download(new Blob([await pieceSVG()], { type: 'image/svg+xml' }), fileBase() + '.svg')));
  /* Print is handled by export.js through the button's data-export. */

  /* Enter in the name moves on to saving, which is the kiosk's whole loop. */
  nameIn.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!btns.png.disabled) btns.png.focus(); }
  });

  initialsIn.value = '';
  draw();

  window.BDSIS = Object.assign(window.BDSIS || {}, { infoday: { draw, raster, initialsOf } });
})();
