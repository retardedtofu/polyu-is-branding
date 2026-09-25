/* The Info Day card generator.

   PolyU Info Day 2026: a visitor picks the two or three Faculties or Schools
   they would cross, and their name lays out a field of those disciplines'
   primitives. The same pipeline discipline as the signature fields applies:
   cyrb128 seeds sfc32 (borrowed from cellhash.js, parity-locked there), three
   draws per cell in a fixed order, and the same name with the same choices
   always draws the same card, on any machine.

   Everything runs in this page. The name is hashed locally, nothing is
   transmitted or stored, and the QR code carries only the INPUTS as a link,
   so a phone that scans it regenerates the identical card locally too.

   THE TEN PRIMITIVES are the iteration surface. Each Faculty or School is
   one token here: shape, two gradient stops (light register), an optional
   dark-register override, and a texture. Change these and everything
   downstream (tiles, cards, exports, QR reproductions) follows. */
(() => {
  'use strict';

  const CH = window.CellHash;
  if (!CH || !CH.cyrb128) return;

  /* ── the ten primitives ────────────────────────────────────────────────
     shape: quarter | circle | square | split | triangle
     texture: none | stripes-v | stripes-d | dots  (texture knocks through
     to the ground colour, so it survives every register and prints clean)
     dark: optional {a, b} override for the dark ground (only Design needs
     one, its near-black disc would vanish). */
  const FACULTIES = [
    { key: 'FB',   en: 'Faculty of Business',
      zh: '工商管理學院', shape: 'quarter', texture: 'none',
      a: '#6C3F92', b: '#4A2A66',
      desc: 'Markets, management and the judgement to run things well.' },
    { key: 'FCMS', en: 'Faculty of Computer and Mathematical Sciences',
      zh: '電子計算及數學科學學院', shape: 'circle', texture: 'stripes-d',
      a: '#00A356', b: '#007A40',
      desc: 'Computing, data and the mathematics underneath both.' },
    { key: 'FCE',  en: 'Faculty of Construction and Environment',
      zh: '建設及環境學院', shape: 'square', texture: 'stripes-d',
      a: '#C40D3C', b: '#8E1F35',
      desc: 'The built world: cities, structures and the environment they sit in.' },
    { key: 'FE',   en: 'Faculty of Engineering',
      zh: '工程學院', shape: 'quarter', texture: 'none',
      a: '#1F6FB2', b: '#134D80',
      desc: 'Making things work: systems, machines and the physics of both.' },
    { key: 'FHSS', en: 'Faculty of Health and Social Sciences',
      zh: '醫療及社會科學院', shape: 'triangle', texture: 'stripes-v',
      a: '#6FBF73', b: '#3E9D5A',
      desc: 'People and their wellbeing, from clinics to communities.' },
    { key: 'FH',   en: 'Faculty of Humanities',
      zh: '人文學院', shape: 'square', texture: 'dots',
      a: '#5B67B8', b: '#3F4A94',
      desc: 'Language, culture and how humans make meaning.' },
    { key: 'FS',   en: 'Faculty of Science',
      zh: '理學院', shape: 'quarter', texture: 'stripes-v',
      a: '#F5A623', b: '#E3701A',
      desc: 'The natural world, questioned carefully.' },
    { key: 'SD',   en: 'School of Design',
      zh: '設計學院', shape: 'circle', texture: 'dots',
      a: '#3A3A3A', b: '#232323', dark: { a: '#D8D4CB', b: '#B7B2A5' },
      desc: 'Form, intent and the craft of making both visible.' },
    { key: 'SFT',  en: 'School of Fashion and Textiles',
      zh: '時裝及紡織學院', shape: 'quarter', texture: 'stripes-v',
      a: '#B0326E', b: '#7C2450',
      desc: 'Material, body and identity, engineered and worn.' },
    { key: 'SHTM', en: 'School of Hotel and Tourism Management',
      zh: '酒店及旅遊業管理學院', shape: 'split', texture: 'none',
      a: '#F7B733', b: '#E97C1A',
      desc: 'Hospitality as a discipline: service, place and welcome.' },
  ];

  /* The two registers, matching the print system. */
  const THEMES = {
    light: { ground: '#FFFFFF', ink: '#14110E', body: '#453F38', meta: '#6E665C',
             mark: 'colour', bdsis: '#A02337' },
    dark:  { ground: '#14110E', ink: '#F4EFE4', body: '#C6C0B3', meta: '#9A9285',
             mark: '#F4EFE4', bdsis: '#F2778C' },
  };

  /* ── card geometry: 90 x 54 mm, the print system's card format ─────────
     Field 15 x 6 cells of 6 mm (whole cells to every trim edge, nothing cut
     through at the knife), band of 18 mm below for the lockup and the name. */
  const W = 90, H = 54, CELL = 6, COLS = 15, ROWS = 6;
  const EMPTY = 0.18;   /* share of cells left to the stock, so the field breathes */

  const n2 = v => Math.round(v * 100) / 100;

  /* shape paths at cell (x, y), rotations matching the kit's own */
  const quarter = (x, y, s, r) => [
    `M${n2(x + s)},${n2(y)} A${s},${s} 0 0,0 ${n2(x)},${n2(y + s)} L${n2(x + s)},${n2(y + s)} Z`,
    `M${n2(x)},${n2(y)} A${s},${s} 0 0,1 ${n2(x + s)},${n2(y + s)} L${n2(x)},${n2(y + s)} Z`,
    `M${n2(x + s)},${n2(y)} A${s},${s} 0 0,1 ${n2(x)},${n2(y + s)} L${n2(x)},${n2(y)} Z`,
    `M${n2(x + s)},${n2(y + s)} A${s},${s} 0 0,1 ${n2(x)},${n2(y)} L${n2(x + s)},${n2(y)} Z`,
  ][r & 3];
  const triangle = (x, y, s, r) => [
    `M${n2(x)},${n2(y)} L${n2(x + s)},${n2(y)} L${n2(x)},${n2(y + s)} Z`,
    `M${n2(x)},${n2(y)} L${n2(x + s)},${n2(y)} L${n2(x + s)},${n2(y + s)} Z`,
    `M${n2(x + s)},${n2(y)} L${n2(x + s)},${n2(y + s)} L${n2(x)},${n2(y + s)} Z`,
    `M${n2(x)},${n2(y)} L${n2(x + s)},${n2(y + s)} L${n2(x)},${n2(y + s)} Z`,
  ][r & 3];

  function facultyFill(f, i, theme) {
    if (theme === 'dark' && f.dark) return [f.dark.a, f.dark.b];
    return [f.a, f.b];
  }

  /* one cell of the field; textures overlay the same path in ground colour */
  function cell(f, gi, x, y, rot, theme, defsSeen, defs, ground, idp) {
    const [a, b] = facultyFill(f, gi, theme);
    const gid = `${idp || 'if'}-${f.key}-${theme}`;
    if (!defsSeen.has(gid)) {
      defsSeen.add(gid);
      defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`);
    }
    const fill = `url(#${gid})`;
    const parts = [];
    let overlayPath = null;
    if (f.shape === 'quarter') {
      const d = quarter(x, y, CELL, rot);
      parts.push(`<path d="${d}" fill="${fill}"/>`); overlayPath = d;
    } else if (f.shape === 'circle') {
      parts.push(`<circle cx="${n2(x + CELL / 2)}" cy="${n2(y + CELL / 2)}" r="${CELL / 2}" fill="${fill}"/>`);
      overlayPath = 'circle';
    } else if (f.shape === 'square') {
      parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${fill}"/>`);
      overlayPath = `M${x},${y} H${x + CELL} V${y + CELL} H${x} Z`;
    } else if (f.shape === 'split') {
      parts.push(`<path d="M${x},${y} L${x + CELL},${y} L${x},${y + CELL} Z" fill="${a}"/>`);
      parts.push(`<path d="M${x + CELL},${y} L${x + CELL},${y + CELL} L${x},${y + CELL} Z" fill="${b}"/>`);
    } else if (f.shape === 'triangle') {
      const d = triangle(x, y, CELL, rot);
      parts.push(`<path d="${d}" fill="${fill}"/>`); overlayPath = d;
    }
    if (f.texture !== 'none' && overlayPath) {
      const pid = `${idp || 'if'}x-${f.texture}-${theme}`;
      if (!defsSeen.has(pid)) {
        defsSeen.add(pid);
        if (f.texture === 'dots')
          defs.push(`<pattern id="${pid}" width="1.7" height="1.7" patternUnits="userSpaceOnUse">` +
            `<circle cx="0.85" cy="0.85" r="0.42" fill="${ground}"/></pattern>`);
        else
          defs.push(`<pattern id="${pid}" width="1.6" height="1.6" patternUnits="userSpaceOnUse"` +
            (f.texture === 'stripes-d' ? ' patternTransform="rotate(45)"' : '') + '>' +
            `<rect x="0" y="0" width="0.55" height="1.6" fill="${ground}"/></pattern>`);
      }
      if (overlayPath === 'circle')
        parts.push(`<circle cx="${n2(x + CELL / 2)}" cy="${n2(y + CELL / 2)}" r="${CELL / 2}" fill="url(#${pid})"/>`);
      else
        parts.push(`<path d="${overlayPath}" fill="url(#${pid})"/>`);
    }
    return parts.join('');
  }

  /* full-coverage stand-in for initials cells: a letter with a bite out of
     it stops being a letter, so quarters and triangles become the disc */
  const SOLID = { quarter: 'circle', triangle: 'square', circle: 'circle',
                  square: 'square', split: 'split' };

  /* ── the field ─────────────────────────────────────────────────────────
     Three draws per cell in the signature-field order (roll, faculty,
     rotation), always taken, so the layout never shifts between options. */
  function buildField(name, picked, initials, theme, defs, defsSeen, ground) {
    const seed = CH.cyrb128(name || ' ');
    const rnd = CH.sfc32(seed[0], seed[1], seed[2], seed[3]);
    const px = initials ? CH.pixelCells(initials, COLS, ROWS, 'micro') : null;
    const out = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const roll = rnd(), famRoll = rnd(), rotRoll = rnd();
      const x = (i % COLS) * CELL, y = ((i / COLS) | 0) * CELL;
      const inText = px && px.has(i);
      if (!inText && roll < EMPTY) continue;
      /* With initials shown, the FIRST pick is reserved for the letters and
         the ground draws from the rest, or the text sinks into a field of
         its own colour. With two picks that still leaves the ground whole. */
      const ground_ = (px && picked.length > 1) ? picked.slice(1) : picked;
      const pool = inText ? [picked[0]] : ground_;
      const gi = pool[Math.min((famRoll * pool.length) | 0, pool.length - 1)];
      const f = FACULTIES[gi];
      const rot = (rotRoll * 4) | 0;
      const shape = inText ? SOLID[f.shape] : f.shape;
      out.push(cell({ ...f, shape }, gi, x, y, rot, theme, defsSeen, defs, ground));
    }
    return out.join('');
  }

  /* ── the lockup: our mark, our face, the bilingual naming ────────────── */
  let markColour = null, markMono = null;
  async function loadMarks() {
    const get = async u => (await fetch(u)).text();
    const strip = t => {
      const m = t.match(/<svg[^>]*viewBox="([\d.\s-]+)"[^>]*>([\s\S]*)<\/svg>/);
      return { vb: m[1].trim().split(/\s+/).map(Number), inner: m[2] };
    };
    markColour = strip(await get('assets/mark-colour.svg'));
    /* every embedded copy gets its own id namespace or the gradients fight */
    markColour.inner = markColour.inner.replace(/id="/g, 'id="ifmk-')
      .replace(/url\(#/g, 'url(#ifmk-');
    markMono = strip(await get('assets/mark-mono.svg'));
    markMono.inner = markMono.inner
      .replace(/fill="(?!none)[^"]*"/g, 'fill="__INK__"')
      .replace(/id="/g, 'id="ifmm-').replace(/url\(#/g, 'url(#ifmm-');
  }

  function lockup(theme) {
    const T = THEMES[theme];
    const mm = 6.68, mx = 5, my = 42.31;
    const mark = T.mark === 'colour'
      ? `<g transform="translate(${mx},${my}) scale(${mm / markColour.vb[2]})">${markColour.inner}</g>`
      : `<g transform="translate(${mx},${my}) scale(${mm / markMono.vb[2]})">${markMono.inner.split('__INK__').join(T.mark)}</g>`;
    const tx = 14;
    const F = 'Helvetica Neue, Helvetica, Arial, sans-serif';
    const FZH = 'Helvetica Neue, PingFang TC, MHei, Heiti TC, sans-serif';
    return mark +
      `<text x="${tx}" y="43.97" font-family="${F}" font-size="1.376" font-weight="500" letter-spacing="0.048" fill="${T.ink}">BACHELOR'S DEGREE SCHEME IN</text>` +
      `<text x="${tx}" y="45.69" font-family="${F}" font-size="1.376" font-weight="500" letter-spacing="0.048" fill="${T.ink}">INTERDISCIPLINARY STUDIES</text>` +
      `<rect x="${tx}" y="46.33" width="19.4" height="0.11" fill="${T.meta}"/>` +
      `<text x="${tx}" y="48.2" font-family="${FZH}" font-size="1.56" font-weight="500" fill="${T.body}">跨學科組合學士課程<tspan fill="${T.bdsis}" font-weight="500"> · BDSIS</tspan></text>`;
  }

  /* ── the whole card ────────────────────────────────────────────────────── */
  function cardSVG(state) {
    const { name, picked, initials, theme } = state;
    const T = THEMES[theme];
    const defs = [], defsSeen = new Set();
    const field = buildField(name, picked, initials, theme, defs, defsSeen, T.ground);
    const F = 'Helvetica Neue, Helvetica, Arial, sans-serif';
    const label = (name || '').trim();
    const nameBlock = label
      ? `<text x="82" y="44.7" text-anchor="end" font-family="${F}" font-size="2.9" font-weight="500" fill="${T.ink}">${esc(label)}</text>` +
        `<text x="82" y="47.9" text-anchor="end" font-family="${F}" font-size="1.6" fill="${T.meta}">PolyU Info Day 2026 · JUPAS JS3000</text>`
      : `<text x="82" y="46.4" text-anchor="end" font-family="${F}" font-size="1.6" fill="${T.meta}">PolyU Info Day 2026 · JUPAS JS3000</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">` +
      `<title>BDSIS Info Day card${label ? ' · ' + esc(label) : ''}</title>` +
      `<defs>${defs.join('')}</defs>` +
      `<rect width="${W}" height="${H}" fill="${T.ground}"/>` +
      field + lockup(theme) + nameBlock + '</svg>';
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ── state and UI ──────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const state = { name: '', picked: [0, 6], initials: '', theme: 'light' };

  let lastSVG = '';
  function render() {
    const svg = cardSVG(state);
    lastSVG = svg;
    $('card-flat').innerHTML = svg;
    document.dispatchEvent(new CustomEvent('if-cardchange'));
    location.hash = hashOf(state);
  }

  /* ── share link: the inputs travel, never the artwork ──────────────────── */
  function hashOf(s) {
    const p = new URLSearchParams();
    if (s.name.trim()) p.set('n', s.name.trim());
    p.set('d', s.picked.map(i => FACULTIES[i].key).join(','));
    if (s.theme !== 'light') p.set('t', s.theme);
    return p.toString();
  }
  function restore() {
    if (!location.hash || location.hash.length < 2) return;
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('n')) { state.name = p.get('n'); $('if-name').value = state.name; }
    if (p.get('d')) {
      const keys = p.get('d').split(',');
      const idx = keys.map(k => FACULTIES.findIndex(f => f.key === k)).filter(i => i >= 0);
      if (idx.length >= 2) state.picked = idx.slice(0, 3);
    }
    const t = p.get('t');
    if (t && THEMES[t]) state.theme = t;
  }

  /* ── wiring ────────────────────────────────────────────────────────────── */
  function tiles() {
    $('if-tiles').innerHTML = FACULTIES.map((f, i) => {
      const on = state.picked.includes(i);
      const defs = [], seen = new Set();
      const sw = cell(f, i, 0, 0, 1, 'light', seen, defs, '#F8F2E7', 'ift' + i);
      return `<button type="button" class="if-tile${on ? ' on' : ''}" data-i="${i}" ` +
        `aria-pressed="${on}" title="${esc(f.desc)}">` +
        `<svg viewBox="0 0 6 6" aria-hidden="true"><defs>${defs.join('')}</defs>${sw}</svg>` +
        `<span>${esc(f.en)}</span><span class="if-tile__box" aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M2 5.3 L4.1 7.4 L8 2.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>`;
    }).join('');
  }

  async function boot() {
    await loadMarks();
    restore();
    tiles();

    $('if-name').addEventListener('input', () => { state.name = $('if-name').value; render(); });
    $('if-tiles').addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      const at = state.picked.indexOf(i);
      if (at >= 0) { if (state.picked.length > 2) state.picked.splice(at, 1); }
      else { if (state.picked.length >= 3) state.picked.shift(); state.picked.push(i); }
      tiles(); render();
    });
    document.querySelectorAll('#if-theme button').forEach(b =>
      b.addEventListener('click', () => {
        state.theme = b.dataset.t;
        document.querySelectorAll('#if-theme button').forEach(x => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
        render();
      }));
    document.querySelector(`#if-theme button[data-t="${state.theme}"]`)?.classList.add('on');
    $('if-print').addEventListener('click', () => window.print());
    window.addEventListener('beforeprint', () => { $('print-card').innerHTML = lastSVG; });
    render();
  }
  window.InfoDayCard = { svg: () => lastSVG, mm: { W, H } };
  boot();
})();
