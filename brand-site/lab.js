'use strict';
/* BDSIS Lab — shared engine. Each exhibit initialises only if its root element exists. */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= palettes ================= */
const PAL = {
  d1: {
    dark:'#11151C', paper:'#FBFAF7', cellline:'#D8D4CA', ghostDark:'rgba(255,255,255,0.16)', ink:'#11151C',
    fams:[['#634093','#A4346B'],['#ED174B','#F0584A'],['#F7941E','#ED174B'],['#8CC75F','#2DB44A'],['#2E9FD6','#0A65A2']],
    asm:[['#634093','#F0584A'],['#ED174B','#F7941E'],['#F68A2E','#ED174B'],['#F7941E','#ED174B'],['#A5CD6B','#7DBF55'],['#4FB94F','#2FB44C'],['#8CC75F','#2DB44A'],['#2E9FD6','#1175AF'],['#1278B2','#04568C'],['#0E6FA9','#0A65A2']],
  },
  d2: {
    dark:'#1E1B36', paper:'#F6F1E6', cellline:'#D9D0BA', ghostDark:'rgba(246,241,230,0.16)', ink:'#231F40',
    fams:[['#4A4178','#8E3A5A'],['#BD2956','#A02447'],['#D9A53C','#BD2956'],['#7BA796','#3F7878'],['#2F6BA4','#143A6B']],
    asm:[['#4A4178','#8E3A5A'],['#A6294E','#D9A53C'],['#DCAB4A','#A6294E'],['#D9A53C','#A6294E'],['#8FB3A2','#6E9C8C'],['#5A918E','#42797A'],['#7BA796','#3F7878'],['#2F6BA4','#1F528B'],['#1F528B','#143A6B'],['#1C4A80','#173F73']],
  },
  d3: {
    dark:'#2E2722', paper:'#F8F2E7', cellline:'#DCD0B6', ghostDark:'rgba(248,242,231,0.16)', ink:'#2E2722',
    fams:[['#894E73','#D24B43'],['#E14729','#C73A20'],['#F4A640','#E14729'],['#B0BC72','#7E9A4D'],['#54ABBB','#26707F']],
    asm:[['#894E73','#D24B43'],['#E14729','#F4A640'],['#F2A03B','#E14729'],['#F4A640','#E14729'],['#C2C684','#A8B468'],['#9CB163','#7E9A4D'],['#B0BC72','#7E9A4D'],['#54ABBB','#3A8FA3'],['#3A8FA3','#26707F'],['#348699','#2C7A8D']],
  },
  d4: {
    dark:'#0B1521', paper:'#F4F9FC', cellline:'#C9DAE6', ghostDark:'rgba(244,249,252,0.16)', ink:'#0B1521',
    fams:[['#3E4AA6','#2C6FC0'],['#E1227C','#B62E86'],['#34C6C3','#1565A8'],['#5FBA8E','#2F8E62'],['#2E9FD6','#04568C']],
    asm:[['#3E4AA6','#2C6FC0'],['#E1227C','#B62E86'],['#34C6C3','#1E86C8'],['#34C6C3','#1565A8'],['#6FC4A0','#4FAE7E'],['#45A87B','#2F8E62'],['#5FBA8E','#2F8E62'],['#2E9FD6','#1175AF'],['#1278B2','#04568C'],['#0E6FA9','#0A65A2']],
  },
};
let cur = 'd1';
const P = () => PAL[cur];
const FAM = n => P().fams[n - 1];
const REPAINT = [];
const $ = id => document.getElementById(id);

/* shared: a fast integer roll, and a "Randomise" control injected next to an
   existing button so every exhibit gets one without editing each page. */
const randInt = n => (Math.random() * n) | 0;
function mkRand(anchor, handler, opts = {}) {
  if (!anchor) return null;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = opts.cls || 'btn-ghosty';
  b.textContent = opts.label || 'Randomise';
  b.setAttribute('aria-label', opts.aria || 'Generate a random version');
  anchor.after(b);
  b.addEventListener('click', handler);
  return b;
}

const dirSwitch = $('dir-switch');
if (dirSwitch) dirSwitch.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  cur = b.dataset.d;
  dirSwitch.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  $('labstage').dataset.theme = cur;
  REPAINT.forEach(f => f());
});

const mulberry32 = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const djb2 = str => { let h = 5381; for (const c of str) h = (h * 33 ^ c.codePointAt(0)) >>> 0; return h; };
/* cyrb128: 128-bit hash of arbitrary unicode strings; sfc32: PRNG seeded from it */
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ b >>> 9; b = c + (c << 3) | 0; c = (c << 21 | c >>> 11); d = d + 1 | 0;
    t = t + d | 0; c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

/* canvas quarter-disc: rot 0=arc bulges top-left, 1=top-right, 2=bottom-right, 3=bottom-left */
function quarter(ctx, x, y, s, rot) {
  ctx.beginPath();
  if (rot === 0)      { ctx.moveTo(x + s, y + s); ctx.arc(x + s, y + s, s, Math.PI, 1.5 * Math.PI); }
  else if (rot === 1) { ctx.moveTo(x, y + s);     ctx.arc(x, y + s, s, 1.5 * Math.PI, 2 * Math.PI); }
  else if (rot === 2) { ctx.moveTo(x, y);         ctx.arc(x, y, s, 0, 0.5 * Math.PI); }
  else                { ctx.moveTo(x + s, y);     ctx.arc(x + s, y, s, 0.5 * Math.PI, Math.PI); }
  ctx.closePath(); ctx.fill();
}
function cdisc(ctx, x, y, s) { ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, 2 * Math.PI); ctx.fill(); }
function csquare(ctx, x, y, s) { ctx.fillRect(x, y, s, s); }
function cdsq(ctx, x, y, s, a, b) {
  ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
}

/* SVG cell builders (100-unit cells). Primitives: q (4 rots), dsq, circle, square, ghost */
function cellSVG(s, c, r, i, fams, cellline, idp) {
  const u = 100, x = c * u, y = r * u, id = (idp || 'g') + i;
  if (!s) return ['', ''];
  if (s.t === 'ghost')
    return ['', `<rect x="${x+2}" y="${y+2}" width="${u-4}" height="${u-4}" fill="none" stroke="${cellline}" stroke-width="2.5"/>`];
  const [a, b] = fams[s.fam - 1];
  const grad = (sfx, x1, y1, x2, y2, ca, cb) =>
    `<linearGradient id="${id}${sfx}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${ca}"/><stop offset="1" stop-color="${cb}"/></linearGradient>`;
  if (s.t === 'dsq') {
    const defs = grad('a', x, y + 50, x + u, y + 50, a, b) + grad('b', x, y + u, x + u, y, b, a);
    return [defs, `<path d="M${x},${y} L${x+u},${y} L${x},${y+u} Z" fill="url(#${id}a)"/><path d="M${x+u},${y} L${x+u},${y+u} L${x},${y+u} Z" fill="url(#${id}b)"/>`];
  }
  if (s.t === 'dsq2') { /* mirrored split: diagonal runs tl→br */
    const defs = grad('a', x, y + 50, x + u, y + 50, b, a) + grad('b', x, y, x + u, y + u, a, b);
    return [defs, `<path d="M${x},${y} L${x+u},${y} L${x+u},${y+u} Z" fill="url(#${id}a)"/><path d="M${x},${y} L${x+u},${y+u} L${x},${y+u} Z" fill="url(#${id}b)"/>`];
  }
  const defs = grad('', x, y, x + u, y + u, a, b);
  if (s.t === 'circle') return [defs, `<circle cx="${x+50}" cy="${y+50}" r="48" fill="url(#${id})"/>`];
  if (s.t === 'square') return [defs, `<rect x="${x}" y="${y}" width="${u}" height="${u}" fill="url(#${id})"/>`];
  const PD = {
    tl: `M${x+u},${y} A${u},${u} 0 0,0 ${x},${y+u} L${x+u},${y+u} Z`,
    tr: `M${x},${y} A${u},${u} 0 0,1 ${x+u},${y+u} L${x},${y+u} Z`,
    br: `M${x+u},${y} A${u},${u} 0 0,1 ${x},${y+u} L${x},${y} Z`,
    bl: `M${x+u},${y+u} A${u},${u} 0 0,1 ${x},${y} L${x+u},${y} Z`,
  }[s.rot];
  return [defs, `<path d="${PD}" fill="url(#${id})"/>`];
}
function gridToSVG(grid, cols, rows) {
  let defs = '', body = '';
  grid.forEach((s, i) => {
    const [d, b] = cellSVG(s, i % cols, (i / cols) | 0, i, P().fams, P().cellline);
    defs += d; body += b;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols*100} ${rows*100}" width="${cols*100}" height="${rows*100}">\n<defs>${defs}</defs>\n${body}\n</svg>`;
}
const download = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
const svgToPNG = (svgStr, w, h, name) => {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgStr], { type:'image/svg+xml' }));
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    c.toBlob(b => download(b, name));
    URL.revokeObjectURL(url);
  };
  img.src = url;
};
/* SVG → PNG Blob (opaque white bg) for clipboard "Copy image" */
const svgToPNGBlob = (svgStr, w, h) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgStr], { type:'image/svg+xml' }));
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, w, h);
    cx.drawImage(img, 0, 0, w, h);
    c.toBlob(b => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('encode failed')); });
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
  img.src = url;
});

/* right-click → "Save as SVG / Copy image / Download PNG" for rendered graphics */
(() => {
  const s = document.createElement('style');
  s.textContent =
    '.img-menu{position:fixed;z-index:9999;background:var(--paper,#fff);border:1px solid var(--line,#e2e0d8);' +
    'border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.18);padding:4px;min-width:172px;' +
    'font-family:var(--font-body,Inter),system-ui,sans-serif;}' +
    '.img-menu-item{display:block;width:100%;text-align:left;background:none;border:0;padding:9px 13px;' +
    'font-size:.85rem;line-height:1.1;color:var(--ink,#11151C);cursor:pointer;border-radius:6px;}' +
    '.img-menu-item:hover,.img-menu-item:focus-visible{background:var(--ink,#11151C);color:var(--paper,#fff);outline:none;}' +
    '.img-menu-note{padding:6px 13px 2px;font-size:.66rem;letter-spacing:.04em;color:var(--grey,#8a8a8a);text-transform:uppercase;}';
  document.head.appendChild(s);
})();
let _imgMenu = null;
const closeImgMenu = () => { if (_imgMenu) { _imgMenu.remove(); _imgMenu = null; } };
function attachSaveMenu(target, opts) {
  if (!target) return;
  target.addEventListener('contextmenu', e => {
    e.preventDefault();
    closeImgMenu();
    const menu = document.createElement('div');
    menu.className = 'img-menu'; menu.setAttribute('role', 'menu');
    const note = document.createElement('div');
    note.className = 'img-menu-note'; note.textContent = opts.title || 'Cell graphic';
    menu.appendChild(note);
    const item = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'img-menu-item'; b.setAttribute('role', 'menuitem');
      b.textContent = label;
      b.addEventListener('click', () => { closeImgMenu(); fn(); });
      menu.appendChild(b);
    };
    item('Save as SVG', () => download(new Blob([opts.svg()], { type:'image/svg+xml' }), opts.name() + '.svg'));
    item('Copy SVG', async () => {
      const svg = opts.svg();
      try {
        // rich clipboard: SVG markup as both plain text and image/svg+xml so it
        // pastes as code in editors and as vectors in Figma/Illustrator
        if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([new ClipboardItem({
            'text/plain': new Blob([svg], { type:'text/plain' }),
            'image/svg+xml': new Blob([svg], { type:'image/svg+xml' }),
          })]);
        } else {
          await navigator.clipboard.writeText(svg);
        }
      } catch (err) {
        try { await navigator.clipboard.writeText(svg); }            // fall back to text only
        catch (e2) { download(new Blob([svg], { type:'image/svg+xml' }), opts.name() + '.svg'); } // last resort
      }
    });
    item('Download PNG', () => { const [w, h] = opts.size(); svgToPNG(opts.svg(), w, h, opts.name() + '.png'); });
    document.body.appendChild(menu);
    _imgMenu = menu;
    let x = e.clientX, y = e.clientY;
    if (x + menu.offsetWidth > innerWidth) x = innerWidth - menu.offsetWidth - 8;
    if (y + menu.offsetHeight > innerHeight) y = innerHeight - menu.offsetHeight - 8;
    menu.style.left = Math.max(8, x) + 'px'; menu.style.top = Math.max(8, y) + 'px';
  });
}
addEventListener('pointerdown', e => { if (_imgMenu && !_imgMenu.contains(e.target)) closeImgMenu(); });
addEventListener('scroll', closeImgMenu, true);
addEventListener('keydown', e => { if (e.key === 'Escape') closeImgMenu(); });

/* monogram cell map (3×3), used by Composer preset + ID card */
const MONOGRAM = [[0,0,'q','tr',1],[1,0,'q','tl',4],[2,0,'q','tr',4],[0,1,'dsq',null,3],[1,1,'q','bl',4],[2,1,'q','tr',5],[0,2,'q','bl',3],[1,2,'q','bl',5],[2,2,'q','br',5]];

/* ================= THE DISPLAY (+ camera) ================= */
(() => {
  const cv = $('display'); if (!cv) return;
  const ctx = cv.getContext('2d', { willReadFrequently:false });
  const COLS = 44, ROWS = 16;
  let cell = 10, W = 0, H = 0, raf = null, t = 0, scene = 0, paused = false, lastSwitch = 0, ph = 0;
  let video = null, stream = null, sampler = null, sctx = null;

  const FONT = {
    'T':['#####','..#..','..#..','..#..','..#..','..#..','..#..'],'H':['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
    'E':['#####','#....','#....','####.','#....','#....','#####'],'F':['#####','#....','#....','####.','#....','#....','#....'],
    'W':['#...#','#...#','#...#','#.#.#','#.#.#','##.##','#...#'],'O':['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
    'R':['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],'M':['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],
    'A':['.###.','#...#','#...#','#####','#...#','#...#','#...#'],'N':['#...#','##..#','#.#.#','#..##','#...#','#...#','#...#'],
    'Y':['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'],'B':['####.','#...#','#...#','####.','#...#','#...#','####.'],
    'D':['####.','#...#','#...#','#...#','#...#','#...#','####.'],'I':['#####','..#..','..#..','..#..','..#..','..#..','#####'],
    'S':['.####','#....','#....','.###.','....#','....#','####.'],'J':['..###','...#.','...#.','...#.','...#.','#..#.',' ##..'],
    '3':['####.','....#','....#','.###.','....#','....#','####.'],'0':['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
    '·':['.....','.....','.....','..#..','.....','.....','.....'],' ':['.....','.....','.....','.....','.....','.....','.....'],
  };
  const TEXT = 'THE FEW · FOR THE MANY · BDSIS · JS3000 · ';
  const textCols = TEXT.length * 6;
  const lit = (col, row) => {
    const ci = ((col % textCols) + textCols) % textCols;
    const glyph = FONT[TEXT[(ci / 6) | 0]] || FONT[' '];
    return ci % 6 !== 5 && glyph[row][ci % 6] === '#';
  };
  const MONO = [[0,0,1,1,'q'],[1,0,0,4,'q'],[2,0,1,4,'q'],[0,1,0,3,'d'],[1,1,3,4,'q'],[2,1,1,5,'q'],[0,2,3,3,'q'],[1,2,3,5,'q'],[2,2,2,5,'q']];

  function size() {
    const w = cv.parentElement.clientWidth;
    cell = w / COLS; W = w; H = cell * ROWS;
    const dpr = devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = H * dpr;
    cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function drawCamera(p, lead, acc) {
    if (!video || video.readyState < 2) return;
    // sample video into COLS×ROWS, cover-cropped, mirrored
    const vw = video.videoWidth, vh = video.videoHeight;
    const target = COLS / ROWS;
    let sw = vw, sh = vh, sx0 = 0, sy0 = 0;
    if (vw / vh > target) { sw = vh * target; sx0 = (vw - sw) / 2; } else { sh = vw / target; sy0 = (vh - sh) / 2; }
    sctx.save(); sctx.scale(-1, 1);
    sctx.drawImage(video, sx0, sy0, sw, sh, -COLS, 0, COLS, ROWS);
    sctx.restore();
    const d = sctx.getImageData(0, 0, COLS, ROWS).data;
    const L = (x, y) => {
      const i = (Math.min(ROWS - 1, Math.max(0, y)) * COLS + Math.min(COLS - 1, Math.max(0, x))) * 4;
      return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    };
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const v = L(x, y) / 255;
      const gx = L(x + 1, y) - L(x - 1, y), gy = L(x, y + 1) - L(x, y - 1);
      const ang = Math.atan2(gy, gx);
      const rot = ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4;
      const px = x * cell + 1, py = y * cell + 1, s = cell - 2;
      if (v > 0.82)      { ctx.fillStyle = '#FFFFFF'; cdisc(ctx, px, py, s); }
      else if (v > 0.58) { ctx.fillStyle = lead[0]; quarter(ctx, px, py, s, rot); }
      else if (v > 0.42) { ctx.fillStyle = lead[1]; csquare(ctx, px, py, s); }
      else if (v > 0.27) { ctx.globalAlpha = 0.55; cdsq(ctx, px, py, s, acc[1], lead[1]); ctx.globalAlpha = 1; }
      else if (v > 0.14) { ctx.strokeStyle = p.ghostDark; ctx.lineWidth = 1; ctx.strokeRect(px + s*0.25, py + s*0.25, s*0.5, s*0.5); }
    }
  }

  function draw() {
    const p = P();
    ctx.clearRect(0, 0, W, H);
    const lead = p.fams[4], acc = p.fams[1];
    if (scene === 0) {
      /* flow field — the full vocabulary, ordered by signal strength:
         circle (peak) → quarter (aimed) → square → split → ghost */
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const a = Math.sin(x * 0.32 + t * 0.8 + ph) + Math.cos(y * 0.52 - t * 0.62 + ph * 1.3) + Math.sin((x + y) * 0.17 + t * 0.33 + ph * 0.7);
        const v = (a + 3) / 6;
        const rot = ((a * 1.7 + 8) | 0) % 4;
        const px = x * cell + 1, py = y * cell + 1, s = cell - 2;
        if (v > 0.93)      { ctx.fillStyle = acc[0]; cdisc(ctx, px, py, s); }
        else if (v > 0.66) { ctx.fillStyle = lead[0]; quarter(ctx, px, py, s, rot); }
        else if (v > 0.52) { ctx.fillStyle = lead[1]; csquare(ctx, px, py, s); }
        else if (v > 0.40) { ctx.globalAlpha = 0.65; cdsq(ctx, px, py, s, lead[0], lead[1]); ctx.globalAlpha = 1; }
        else if (v > 0.30) { ctx.strokeStyle = p.ghostDark; ctx.lineWidth = 1; ctx.strokeRect(px + s*0.18, py + s*0.18, s*0.64, s*0.64); }
      }
    } else if (scene === 1) {
      const off = Math.floor(t * 8), top = Math.floor((ROWS - 7) / 2);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const px = x * cell + 1, py = y * cell + 1, s = cell - 2;
        if (y >= top && y < top + 7 && lit(x + off, y - top)) {
          const k = (x * 7 + y * 11) % 10;
          ctx.fillStyle = (x + y) % 7 === 0 ? lead[1] : lead[0];
          if (k < 6) quarter(ctx, px, py, s, (x + y) % 4);
          else if (k < 8) cdisc(ctx, px, py, s);
          else if (k < 9) csquare(ctx, px, py, s);
          else cdsq(ctx, px, py, s, lead[0], lead[1]);
        } else {
          ctx.strokeStyle = p.ghostDark; ctx.lineWidth = 1;
          ctx.strokeRect(px + s*0.3, py + s*0.3, s*0.4, s*0.4);
        }
      }
    } else if (scene === 2) {
      const B = Math.floor(ROWS / 3.4);
      const ox = Math.floor((COLS - B * 3) / 2), oy = Math.floor((ROWS - B * 3) / 2);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const px = x * cell + 1, py = y * cell + 1, s = cell - 2;
        ctx.strokeStyle = p.ghostDark; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
        ctx.strokeRect(px + s*0.3, py + s*0.3, s*0.4, s*0.4); ctx.globalAlpha = 1;
      }
      MONO.forEach(([mc, mr, rot, fam, type]) => {
        const [a, b] = p.fams[fam - 1];
        for (let sy = 0; sy < B; sy++) for (let sx = 0; sx < B; sx++) {
          const ux = (sx + 0.5) / B, uy = (sy + 0.5) / B;
          let inside = type === 'd';
          if (!inside) {
            const ccx = rot === 0 ? 1 : rot === 1 ? 0 : rot === 2 ? 0 : 1;
            const ccy = rot === 0 ? 1 : rot === 1 ? 1 : rot === 2 ? 0 : 0;
            inside = (ux - ccx) ** 2 + (uy - ccy) ** 2 <= 1;
          }
          if (!inside) continue;
          const gx = ox + mc * B + sx, gy = oy + mr * B + sy;
          const px = gx * cell + 1, py = gy * cell + 1, s = cell - 2;
          const wave = 0.5 + 0.5 * Math.sin(t * 1.6 - (ux + uy) * 2.2 - (mc + mr));
          ctx.fillStyle = type === 'd' ? ((ux + uy < 1) ? a : b) : (wave > 0.45 ? a : b);
          quarter(ctx, px, py, s, rot);
        }
      });
    } else if (scene === 3) {
      drawCamera(p, lead, acc);
    }
  }

  function loop(now) {
    t = now / 1000;
    if (scene !== 3 && now - lastSwitch > 9000) setScene((scene + 1) % 3, now);
    draw();
    raf = requestAnimationFrame(loop);
  }
  function stopCamera() {
    if (stream) { stream.getTracks().forEach(tr => tr.stop()); stream = null; video = null; }
  }
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:{ ideal:320 } }, audio:false });
      video = document.createElement('video');
      video.srcObject = stream; video.muted = true; video.playsInline = true;
      await video.play();
      if (!sampler) { sampler = document.createElement('canvas'); sampler.width = COLS; sampler.height = ROWS; sctx = sampler.getContext('2d', { willReadFrequently:true }); }
      if (paused) $('disp-pause').click();
      return true;
    } catch (err) {
      $('disp-hint').textContent = 'Camera unavailable or permission declined. The other programmes still run.';
      return false;
    }
  }
  async function setScene(s, now) {
    if (s === 3) { const ok = await startCamera(); if (!ok) return; }
    else if (scene === 3) stopCamera();
    scene = s; lastSwitch = now ?? performance.now();
    document.querySelectorAll('#disp-dots button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.s === s));
  }
  $('disp-dots').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setScene(+b.dataset.s).then(() => { if (REDUCED || paused) { t = performance.now() / 1000; draw(); } });
  });
  $('disp-pause').addEventListener('click', () => {
    paused = !paused;
    $('disp-pause').textContent = paused ? 'Play' : 'Pause';
    if (paused) { cancelAnimationFrame(raf); raf = null; }
    else { lastSwitch = performance.now(); raf = requestAnimationFrame(loop); }
  });
  mkRand($('disp-pause'), () => {
    ph = Math.random() * 6.283;                 // re-phase the flow field
    setScene(randInt(3)).then(() => {           // jump to a random programme (skip camera)
      if (REDUCED || paused) { t = performance.now() / 1000; } else { lastSwitch = performance.now(); }
      draw();
    });
  }, { aria:'Re-phase and switch programme' });
  addEventListener('pagehide', stopCamera);
  document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 3) { stopCamera(); setScene(0); } });
  new ResizeObserver(size).observe(cv.parentElement);
  size();
  if (REDUCED) { scene = 2; t = 1.2; draw(); paused = true; $('disp-pause').textContent = 'Play';
    document.querySelectorAll('#disp-dots button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.s === 2)); }
  else { lastSwitch = performance.now(); raf = requestAnimationFrame(loop); }
  REPAINT.push(draw);
})();

/* ================= KALEIDOSCOPE ================= */
(() => {
  const kal = $('kal'); if (!kal) return;
  const COLS = 12, ROWS = 6, N = COLS * ROWS;
  kal.style.gridTemplateColumns = `repeat(${COLS},1fr)`;
  const rots = new Array(N).fill(0), cells = [];
  for (let i = 0; i < N; i++) {
    const d = document.createElement('div');
    d.style.aspectRatio = '1'; d.style.borderRadius = '100% 0 0 0';
    cells.push(d); kal.appendChild(d);
  }
  let accentSeed = 0;
  function colors() {
    const p = P();
    cells.forEach((d, i) => {
      const x = i % COLS, y = (i / COLS) | 0;
      const accent = (x * 7 + y * 5 + accentSeed) % 13 === 0;
      const [a, b] = accent ? p.fams[2] : p.fams[4];
      d.style.background = `linear-gradient(135deg, ${a}, ${b})`;
      d.style.opacity = accent ? 1 : 0.55 + 0.45 * ((x + y + accentSeed) % 3 === 0 ? 1 : 0.3);
    });
  }
  colors(); REPAINT.push(colors);
  let beat = 0, mode = 0, timer = null;
  const step = () => {
    const turn = i => { rots[i] += 90; cells[i].style.transform = `rotate(${rots[i]}deg)`; };
    mode = ((beat / 6) | 0) % 4;
    for (let i = 0; i < N; i++) {
      const x = i % COLS, y = (i / COLS) | 0;
      if (mode === 0 && y === beat % ROWS) turn(i);
      else if (mode === 1 && x === beat % COLS) turn(i);
      else if (mode === 2 && (x + y) % 2 === beat % 2) turn(i);
      else if (mode === 3 && (x + y) === beat % (COLS + ROWS)) turn(i);
    }
    beat++;
  };
  let started = false;
  const start = () => { if (!timer && !REDUCED) { timer = setInterval(step, 1600); if (!started) { started = true; step(); } } };
  $('kal-pause').addEventListener('click', () => {
    if (timer) { clearInterval(timer); timer = null; $('kal-pause').textContent = 'Play'; }
    else { start(); step(); $('kal-pause').textContent = 'Pause'; }
  });
  mkRand($('kal-pause'), () => {
    accentSeed = randInt(13);
    for (let i = 0; i < N; i++) { rots[i] = randInt(4) * 90; cells[i].style.transform = `rotate(${rots[i]}deg)`; }
    colors();
  }, { aria:'Re-seed the pattern' });
  start();
})();

/* ================= COMPOSER ================= */
(() => {
  const board = $('board'); if (!board) return;
  const ROTS = ['tl','tr','br','bl'];
  let cols = 9, rows = 3, brush = 'q', fam = 2, grid = [];
  const undoStack = [];
  const snapshot = () => { undoStack.push(JSON.stringify(grid)); if (undoStack.length > 60) undoStack.shift(); };

  function build(c, r) {
    cols = c; rows = r; grid = Array(c * r).fill(null);
    board.style.gridTemplateColumns = `repeat(${c},1fr)`;
    board.innerHTML = '';
    for (let i = 0; i < c * r; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cell'; b.dataset.i = i;
      b.setAttribute('aria-label', `Cell ${i % c + 1},${(i / c | 0) + 1}`);
      b.style.aspectRatio = '1';
      b.innerHTML = '<span class="gridline"></span><span class="fill"></span>';
      board.appendChild(b);
    }
    paintAll();
  }
  const classFor = s => !s ? '' :
    s.t === 'q' ? `qq ${s.rot}` : s.t === 'dsq' ? 'dd' :
    s.t === 'circle' ? 'cc' : s.t === 'square' ? 'ss' : 'gg';
  function paint(i) {
    const fill = board.children[i].querySelector('.fill');
    const s = grid[i];
    fill.className = 'fill ' + classFor(s);
    if (s && s.t !== 'ghost') {
      fill.style.setProperty('--ca', FAM(s.fam)[0]);
      fill.style.setProperty('--cb', FAM(s.fam)[1]);
    } else { fill.style.removeProperty('--ca'); fill.style.removeProperty('--cb'); }
  }
  const paintAll = () => { for (let i = 0; i < grid.length; i++) paint(i); };
  REPAINT.push(paintAll);

  function stamp(i) {
    snapshot();
    const c = grid[i];
    if (brush === 'erase') grid[i] = null;
    else if (brush === 'ghost') grid[i] = (c && c.t === 'ghost') ? null : { t:'ghost' };
    else if (brush === 'q') {
      if (c && c.t === 'q' && c.fam === fam) grid[i] = { t:'q', rot:ROTS[(ROTS.indexOf(c.rot) + 1) % 4], fam };
      else grid[i] = { t:'q', rot:'tl', fam };
    } else grid[i] = (c && c.t === brush && c.fam === fam) ? null : { t:brush, fam };
    paint(i);
  }
  board.addEventListener('click', e => { const c = e.target.closest('.cell'); if (c) stamp(+c.dataset.i); });
  attachSaveMenu(board, {
    title: 'Composition',
    svg: () => gridToSVG(grid, cols, rows),
    name: () => 'bdsis-cells',
    size: () => [cols * 200, rows * 200],
  });
  board.addEventListener('mouseover', e => {
    const c = e.target.closest('.cell'); if (!c) return;
    const i = +c.dataset.i;
    if (grid[i] || brush === 'erase') return;
    const fill = c.querySelector('.fill');
    const s = brush === 'q' ? { t:'q', rot:'tl', fam } : brush === 'ghost' ? { t:'ghost' } : { t:brush, fam };
    fill.className = 'fill preview ' + classFor(s);
    if (s.t !== 'ghost') { fill.style.setProperty('--ca', FAM(fam)[0]); fill.style.setProperty('--cb', FAM(fam)[1]); }
  });
  board.addEventListener('mouseout', e => { const c = e.target.closest('.cell'); if (c) paint(+c.dataset.i); });

  const segSelect = (el, attr, cb) => el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    cb(b.dataset[attr]);
  });
  segSelect($('brush-seg'), 'brush', v => brush = v);
  segSelect($('fam-chips'), 'fam', v => fam = +v);
  const syncSizeInputs = () => { if ($('size-cols')) { $('size-cols').value = cols; $('size-rows').value = rows; } };
  segSelect($('size-seg'), 'size', v => { const [c, r] = v.split('x').map(Number); build(c, r); syncSizeInputs(); });
  const applyCustomSize = () => {
    const c = Math.min(40, Math.max(1, parseInt($('size-cols').value, 10) || cols));
    const r = Math.min(40, Math.max(1, parseInt($('size-rows').value, 10) || rows));
    $('size-cols').value = c; $('size-rows').value = r;
    document.querySelectorAll('#size-seg button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    build(c, r);
  };
  if ($('size-apply')) {
    $('size-apply').addEventListener('click', applyCustomSize);
    ['size-cols','size-rows'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') applyCustomSize(); }));
  }
  $('undo').addEventListener('click', () => { if (undoStack.length) { grid = JSON.parse(undoStack.pop()); paintAll(); } });
  $('clear').addEventListener('click', () => { snapshot(); grid.fill(null); paintAll(); });
  mkRand($('clear'), () => {
    snapshot();
    const lead = 1 + randInt(5);
    let accent = 1 + randInt(5); if (accent === lead) accent = 1 + (accent % 5);
    for (let i = 0; i < grid.length; i++) {
      const roll = Math.random(), f = Math.random() < 0.18 ? accent : lead;
      grid[i] = roll < 0.46 ? { t:'q', rot:ROTS[randInt(4)], fam:f }
        : roll < 0.62 ? { t:'dsq', fam:f }
        : roll < 0.74 ? { t:'circle', fam:f }
        : roll < 0.86 ? { t:'square', fam:f } : null;
    }
    paintAll();
  }, { aria:'Fill the grid with a random composition' });

  const PRESETS = {
    spark:      { cols:5, rows:2, cells:[...Array(10).keys()].map(i => [i % 5, i / 5 | 0, 'ghost', null, 0]).concat([[2,1,'q','tl',2]]) },
    mentor:     { cols:4, rows:2, cells:[[0,0,'ghost'],[3,0,'ghost'],[0,1,'ghost'],[1,1,'ghost'],[3,1,'ghost'],[1,0,'q','tl',1],[2,0,'q','tr',1],[2,1,'dsq',null,3]] },
    foundation: { cols:3, rows:2, cells:[[0,0,'ghost'],[1,0,'ghost'],[2,0,'ghost'],[1,1,'q','bl',4]] },
    ascent:     { cols:4, rows:2, cells:[[0,0,'ghost'],[1,0,'ghost'],[3,0,'ghost'],[0,1,'ghost'],[2,1,'ghost'],[3,1,'ghost'],[2,0,'q','tr',3],[1,1,'q','tr',2]] },
    cohort:     { cols:5, rows:2, cells:[[0,0,'q','tl',1],[1,0,'q','br',2],[2,0,'dsq',null,3],[3,0,'q','bl',4],[4,0,'q','tr',5],[0,1,'q','br',4],[1,1,'circle',null,5],[2,1,'q','tr',2],[3,1,'ghost'],[4,1,'square',null,3]] },
    monogram:   { cols:3, rows:3, cells:MONOGRAM },
  };
  $('presets').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const p = PRESETS[b.dataset.preset];
    document.querySelectorAll('#size-seg button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    build(p.cols, p.rows);
    syncSizeInputs();
    p.cells.forEach(([c, r, t, rot, f]) => {
      grid[r * p.cols + c] = t === 'ghost' ? { t:'ghost' } : t === 'q' ? { t:'q', rot, fam:f } : { t, fam:f };
    });
    paintAll();
  });

  $('dl-svg').addEventListener('click', () =>
    download(new Blob([gridToSVG(grid, cols, rows)], { type:'image/svg+xml' }), 'bdsis-cells.svg'));
  $('dl-png').addEventListener('click', () =>
    svgToPNG(gridToSVG(grid, cols, rows), cols * 200, rows * 200, 'bdsis-cells.png'));
  window.__composer = { toSVG: () => gridToSVG(grid, cols, rows), build, get grid() { return grid; } };
  build(9, 3);
})();

/* ================= YOUR MARK — generative cell grid ================= */
(() => {
  const out = $('mark-out'); if (!out) return;
  /*
   * Any string, any language, any length → cyrb128 (128-bit) → sfc32 stream.
   * Free (unmirrored) composition: one lead family, sparse accent cells, the
   * full five-primitive vocabulary. Preview renders on canvas (grids up to
   * 256×256 = 65,536 cells), letterboxed to fit the resizable container.
   * Downloads: SVG with shared gradient defs, PNG capped at 8192 px.
   */
  const ROTS = ['tl','tr','br','bl'];
  const cvs = document.createElement('canvas');
  cvs.style.cssText = 'display:block;width:100%;height:100%;';
  out.appendChild(cvs);
  const ctx = cvs.getContext('2d');
  let grid = null, gcols = 7, grows = 5, lastTag = '', lastInput = '';
  let rafPending = false;

  function genMark(input, cols, rows) {
    const seeds = cyrb128(input);
    const rnd = sfc32(seeds[0], seeds[1], seeds[2], seeds[3]);
    const lead = 1 + (seeds[0] % 5);
    let accent = 1 + (seeds[1] % 5); if (accent === lead) accent = 1 + (accent % 5);
    const g = new Array(cols * rows).fill(null);
    for (let i = 0; i < g.length; i++) {
      const roll = rnd(), famRoll = rnd(), rotRoll = rnd();
      const fam = famRoll < 0.12 ? accent : lead;
      g[i] = roll < 0.50 ? { t:'q', rot:(rotRoll * 4) | 0, fam }
        : roll < 0.66 ? { t:'dsq', fam }
        : roll < 0.78 ? { t:'circle', fam }
        : roll < 0.88 ? { t:'square', fam }
        : null;
    }
    return { grid: g, tag: seeds[0].toString(16).padStart(8, '0').toUpperCase() };
  }

  function draw() {
    rafPending = false;
    if (!grid) return;
    const p = P();
    const cw = out.clientWidth, ch = out.clientHeight;
    const dpr = devicePixelRatio || 1;
    cvs.width = cw * dpr; cvs.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const s = Math.min(cw / gcols, ch / grows);          // letterbox: fit, keep aspect
    const ox = (cw - s * gcols) / 2, oy = (ch - s * grows) / 2;
    const useGrad = gcols * grows <= 2500 && s >= 6;
    for (let i = 0; i < grid.length; i++) {
      const cell = grid[i]; if (!cell) continue;
      const c = i % gcols, r = (i / gcols) | 0;
      const px = ox + c * s, py = oy + r * s;
      if (cell.t === 'ghost') {
        if (s >= 5) { ctx.strokeStyle = p.cellline; ctx.lineWidth = Math.max(0.6, s * 0.03); ctx.strokeRect(px + s*0.06, py + s*0.06, s*0.88, s*0.88); }
        else { ctx.fillStyle = p.cellline; ctx.globalAlpha = 0.35; ctx.fillRect(px + s*0.15, py + s*0.15, s*0.7, s*0.7); ctx.globalAlpha = 1; }
        continue;
      }
      const [a, b] = FAM(cell.fam);
      let fill = a;
      if (useGrad) {
        const gr = ctx.createLinearGradient(px, py, px + s, py + s);
        gr.addColorStop(0, a); gr.addColorStop(1, b);
        fill = gr;
      }
      if (cell.t === 'q') { ctx.fillStyle = fill; quarter(ctx, px, py, s, cell.rot); }
      else if (cell.t === 'circle') { ctx.fillStyle = fill; cdisc(ctx, px, py, s); }
      else if (cell.t === 'square') { ctx.fillStyle = useGrad ? fill : b; csquare(ctx, px, py, s); }
      else if (cell.t === 'dsq') cdsq(ctx, px, py, s, a, b);
    }
  }
  const scheduleDraw = () => { if (!rafPending) { rafPending = true; requestAnimationFrame(draw); } };
  new ResizeObserver(scheduleDraw).observe(out);
  REPAINT.push(scheduleDraw);

  /* SVG export with shared gradient defs (objectBoundingBox) — stays small even at 256×256 */
  function markToSVG() {
    const p = P(), u = 20, W = gcols * u, H = grows * u;
    let defs = '';
    for (let f = 1; f <= 5; f++) {
      const [a, b] = p.fams[f - 1];
      defs += `<linearGradient id="f${f}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
    }
    const parts = [];
    const PD = (x, y) => ({
      0: `M${x+u},${y} A${u},${u} 0 0,0 ${x},${y+u} L${x+u},${y+u} Z`,
      1: `M${x},${y} A${u},${u} 0 0,1 ${x+u},${y+u} L${x},${y+u} Z`,
      2: `M${x+u},${y} A${u},${u} 0 0,1 ${x},${y+u} L${x},${y} Z`,
      3: `M${x+u},${y+u} A${u},${u} 0 0,1 ${x},${y} L${x+u},${y} Z`,
    });
    grid.forEach((cell, i) => {
      if (!cell) return;
      const c = i % gcols, r = (i / gcols) | 0, x = c * u, y = r * u;
      if (cell.t === 'ghost') { parts.push(`<rect x="${x+0.6}" y="${y+0.6}" width="${u-1.2}" height="${u-1.2}" fill="none" stroke="${p.cellline}" stroke-width="0.7"/>`); return; }
      const [a, b] = P().fams[cell.fam - 1], gid = `url(#f${cell.fam})`;
      if (cell.t === 'q') parts.push(`<path d="${PD(x, y)[cell.rot]}" fill="${gid}"/>`);
      else if (cell.t === 'circle') parts.push(`<circle cx="${x+u/2}" cy="${y+u/2}" r="${u/2-0.4}" fill="${gid}"/>`);
      else if (cell.t === 'square') parts.push(`<rect x="${x}" y="${y}" width="${u}" height="${u}" fill="${gid}"/>`);
      else if (cell.t === 'dsq') parts.push(
        `<path d="M${x},${y} L${x+u},${y} L${x},${y+u} Z" fill="${a}"/>`,
        `<path d="M${x+u},${y} L${x+u},${y+u} L${x},${y+u} Z" fill="${b}"/>`);
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n<defs>${defs}</defs>\n${parts.join('')}\n</svg>`;
  }

  function dims() {
    const c = Math.min(256, Math.max(2, parseInt($('mark-cols').value, 10) || 7));
    const r = Math.min(256, Math.max(2, parseInt($('mark-rows').value, 10) || 5));
    $('mark-cols').value = c; $('mark-rows').value = r;
    return [c, r];
  }
  function render() {
    const input = $('mark-name').value.length ? $('mark-name').value : 'BDSIS';
    lastInput = input;
    [gcols, grows] = dims();
    const res = genMark(input, gcols, grows);
    grid = res.grid; lastTag = res.tag;
    scheduleDraw();
    $('mark-label').textContent = `MARK #${res.tag} · ${gcols}×${grows} · "${input.length > 32 ? input.slice(0, 32) + '…' : input}"`;
  }
  $('mark-make').addEventListener('click', render);
  mkRand($('mark-make'), () => {
    $('mark-name').value = Math.random().toString(36).slice(2, 10).toUpperCase();
    render();
  }, { aria:'Generate a mark from a random seed' });
  ['mark-name','mark-cols','mark-rows'].forEach(id => {
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter') render(); });
  });
  ['mark-cols','mark-rows'].forEach(id => $(id).addEventListener('change', render));
  $('mark-dl-svg').addEventListener('click', () => { if (grid) download(new Blob([markToSVG()], { type:'image/svg+xml' }), `bdsis-mark-${lastTag.toLowerCase()}.svg`); });
  $('mark-dl-png').addEventListener('click', () => {
    if (!grid) return;
    const per = Math.max(4, Math.min(200, Math.floor(8192 / Math.max(gcols, grows))));
    svgToPNG(markToSVG(), gcols * per, grows * per, `bdsis-mark-${lastTag.toLowerCase()}.png`);
  });
  attachSaveMenu(out, {
    title: 'Your Mark',
    svg: markToSVG,
    name: () => `bdsis-mark-${lastTag.toLowerCase()}`,
    size: () => { const per = Math.max(4, Math.min(200, Math.floor(8192 / Math.max(gcols, grows)))); return [gcols * per, grows * per]; },
  });
  window.__mark = { genMark, markToSVG };
  render();
})();

/* ================= OPEN SEAT ================= */
(() => {
  const seats = $('seats'); if (!seats) return;
  const FOCI = [
    'Learning Science','Applied Mathematics + AI','Information Systems · Minor in Design',
    'Hotel Management + Applied Psychology','Quantitative Finance + FinTech','Investment + Marketing',
    'Management · Minor in AI & Data Analytics','Computer Science + Game Design','Accounting, Maths + FinTech',
    'Applied Mathematics','Data Science, AI + Neuroscience','AI + Finance','AI + Aviation',
    'AI + Financial Technology','Applied Maths + Finance','Spatial Data Science + Smart Cities',
    'Mathematical Modelling · Minor in Spanish','AI for Financial Analytics','Computer Science + AI',
  ];
  const tip = $('seat-tip'), msg = $('seat-msg');
  const rot = ['tl','tr','br','bl'];
  const DEFAULT_TAKEN = [0,1,3,4,5,7,8,9,11,12,14,16,17,19,21,22,24,26,28];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function populate(taken, foci) {
    seats.innerHTML = ''; let fi = 0;
    for (let i = 0; i < 30; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'seat';
      b.innerHTML = '<span class="gridline"></span><span class="fill"></span>';
      if (taken.includes(i)) {
        const f = (fi % 5) + 1;
        b.dataset.focus = foci[fi % foci.length]; b.dataset.n = ++fi; b.dataset.fam = f; b.dataset.rot = rot[i % 4];
        b.setAttribute('aria-label', `Student ${fi}: ${b.dataset.focus}`);
      } else {
        b.classList.add('open');
        b.style.setProperty('--d', (i * 0.31 % 2.6).toFixed(2) + 's');
        b.setAttribute('aria-label', 'Open seat, choose it');
      }
      seats.appendChild(b);
    }
    paintSeats();
  }
  function paintSeats() {
    seats.querySelectorAll('.seat[data-fam]').forEach(b => {
      const el = b.querySelector('.fill');
      el.className = 'fill qq ' + b.dataset.rot;
      el.style.setProperty('--ca', FAM(+b.dataset.fam)[0]);
      el.style.setProperty('--cb', FAM(+b.dataset.fam)[1]);
    });
  }
  REPAINT.push(paintSeats);
  /* randomise control above the grid — a fresh founding cohort each click */
  const ctrl = document.createElement('div');
  ctrl.className = 'cv-controls'; ctrl.style.margin = '0 0 1.1rem';
  const rb = document.createElement('button');
  rb.type = 'button'; rb.className = 'btn-ghosty'; rb.textContent = 'Randomise cohort';
  rb.setAttribute('aria-label', 'Re-draw a random founding cohort');
  ctrl.appendChild(rb);
  seats.parentElement.insertBefore(ctrl, seats);
  rb.addEventListener('click', () => {
    const count = 16 + randInt(8); // 16–23 of 30 taken
    const taken = shuffle([...Array(30).keys()]).slice(0, count).sort((a, b) => a - b);
    populate(taken, shuffle([...FOCI]));
    msg.innerHTML = `<span class="hint">${count} taken · ${30 - count} open · hover a filled cell · choose an open one</span>`;
  });
  populate(DEFAULT_TAKEN, FOCI);
  const showTip = b => {
    const r = b.getBoundingClientRect();
    tip.innerHTML = `<span class="t-num">STUDENT ${b.dataset.n} · 2025 COHORT</span>${b.dataset.focus}`;
    tip.style.left = Math.min(innerWidth - 260, r.left) + 'px';
    tip.style.top = (r.top - 8 - tip.offsetHeight) + 'px';
    tip.classList.add('show');
  };
  seats.addEventListener('mouseover', e => {
    const b = e.target.closest('.seat');
    if (!b || !b.dataset.focus) { tip.classList.remove('show'); return; }
    showTip(b);
  });
  seats.addEventListener('mouseleave', () => tip.classList.remove('show'));
  seats.addEventListener('focusin', e => {
    const b = e.target.closest('.seat');
    if (b && b.dataset.focus) showTip(b); else tip.classList.remove('show');
  });
  seats.addEventListener('click', e => {
    const b = e.target.closest('.seat.open'); if (!b) return;
    const el = b.querySelector('.fill');
    b.classList.remove('open');
    b.dataset.fam = 2; b.dataset.rot = 'tl';
    el.className = 'fill qq tl';
    el.style.setProperty('--ca', FAM(2)[0]); el.style.setProperty('--cb', FAM(2)[1]);
    if (!REDUCED) el.animate(
      [{ transform:'scale(0.6)', opacity:0 }, { transform:'scale(1)', opacity:1 }],
      { duration:420, easing:'cubic-bezier(0.22, 1, 0.36, 1)' });
    b.setAttribute('aria-label', 'Your seat');
    msg.innerHTML = `<span class="voice" style="font-size:1.15rem;">"Seat twenty of thirty. This one's yours."</span>
      <a class="btn-prime" href="https://www.polyu.edu.hk/cus/" target="_blank" rel="noopener">Begin at JS3000</a>`;
  });
})();

/* ================= TOY BIN ================= */
(() => {
  const cv = $('bin'); if (!cv) return;
  if (!window.Matter) window.addEventListener('load', init, { once:true });
  else init();

  function init() {
    if (!window.Matter) { $('bin-hint').textContent = 'Physics engine unavailable (offline). The rest of the Lab still works.'; return; }
    const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Runner } = Matter;
    const ctx = cv.getContext('2d');
    let W = 0, H = 400, S = 56;
    const engine = Engine.create({ gravity:{ x:0, y:1 } });
    const runner = Runner.create();
    let walls = [], pieces = [], snapped = false, tweens = null, tweening = false;

    function size() {
      W = cv.parentElement.clientWidth;
      const dpr = devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Composite.remove(engine.world, walls);
      walls = [
        Bodies.rectangle(W / 2, H + 30, W + 120, 60, { isStatic:true }),
        Bodies.rectangle(-30, H / 2, 60, H * 3, { isStatic:true }),
        Bodies.rectangle(W + 30, H / 2, 60, H * 3, { isStatic:true }),
      ];
      Composite.add(engine.world, walls);
    }
    size();
    new ResizeObserver(size).observe(cv.parentElement);

    const TYPES = ['q','q','dsq','circle','square','ghost'];
    function drop(n) {
      if (snapped && !tweening) releaseAll();
      for (let i = 0; i < n; i++) {
        if (pieces.length >= 36) { const old = pieces.shift(); Composite.remove(engine.world, old); }
        const type = TYPES[(Math.random() * TYPES.length) | 0];
        const body = type === 'circle'
          ? Bodies.circle(40 + Math.random() * (W - 80), -40 - i * 70, S / 2, { restitution:0.3, friction:0.5, frictionAir:0.012 })
          : Bodies.rectangle(40 + Math.random() * (W - 80), -40 - i * 70, S, S, { restitution:0.25, friction:0.6, frictionAir:0.012, angle:(Math.random() - 0.5) * 0.8 });
        body.cell = { type, rot:(Math.random() * 4) | 0, fam:1 + ((Math.random() * 5) | 0) };
        pieces.push(body); Composite.add(engine.world, body);
      }
    }
    const mouse = Mouse.create(cv);
    mouse.pixelRatio = devicePixelRatio || 1;
    const mc = MouseConstraint.create(engine, { mouse, constraint:{ stiffness:0.15, damping:0.1 } });
    Composite.add(engine.world, mc);

    function snapAll() {
      if (!pieces.length || snapped || tweening) return;
      Runner.stop(runner); snapped = true; tweening = true;
      const colsN = Math.floor(W / S), x0 = (W - colsN * S) / 2;
      const slots = [];
      for (let r = 0; ; r++) { for (let c = 0; c < colsN; c++) slots.push([x0 + c * S + S / 2, H - r * S - S / 2]); if (slots.length >= pieces.length) break; }
      const sorted = [...pieces].sort((a, b) => b.position.y - a.position.y);
      const t0 = performance.now(), DUR = REDUCED ? 0 : 650;
      tweens = sorted.map((p, i) => ({
        p, from:{ x:p.position.x, y:p.position.y, a:p.angle },
        to:{ x:slots[i][0], y:slots[i][1], a:Math.round(p.angle / (Math.PI / 2)) * (Math.PI / 2) },
      }));
      const ease = u => 1 - Math.pow(1 - u, 4);
      (function anim(now) {
        const u = DUR ? Math.min(1, (now - t0) / DUR) : 1, k = ease(u);
        tweens.forEach(({ p, from, to }) => {
          Body.setPosition(p, { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
          Body.setAngle(p, from.a + (to.a - from.a) * k);
          Body.setVelocity(p, { x:0, y:0 }); Body.setAngularVelocity(p, 0);
        });
        if (u < 1) requestAnimationFrame(anim);
        else { tweens.forEach(({ p }) => Body.setStatic(p, true)); tweening = false; }
      })(t0);
    }
    function releaseAll() {
      if (tweening) return;
      snapped = false;
      pieces.forEach(p => { Body.setStatic(p, false); Body.setVelocity(p, { x:(Math.random() - 0.5) * 4, y:-2 - Math.random() * 3 }); Body.setAngularVelocity(p, (Math.random() - 0.5) * 0.3); });
      Runner.run(runner, engine);
    }
    function reset() {
      if (tweening) return;
      pieces.forEach(p => Composite.remove(engine.world, p));
      pieces = []; snapped = false;
      Runner.stop(runner); Runner.run(runner, engine);
      drop(8);
    }
    $('bin-drop').addEventListener('click', () => drop(5));
    $('bin-snap').addEventListener('click', snapAll);
    $('bin-release').addEventListener('click', releaseAll);
    $('bin-reset').addEventListener('click', reset);
    mkRand($('bin-reset'), () => {
      if (tweening) return;
      pieces.forEach(p => Composite.remove(engine.world, p));
      pieces = []; snapped = false;
      Runner.stop(runner); Runner.run(runner, engine);
      drop(6 + randInt(9)); // 6–14 random pieces
    }, { aria:'Tip out a random spill of pieces' });

    function drawPiece(p) {
      const { x, y } = p.position, h = S / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.angle);
      const cell = p.cell, pal = P();
      if (cell.type === 'ghost') {
        ctx.strokeStyle = pal.cellline; ctx.lineWidth = 2;
        ctx.strokeRect(-h + 2, -h + 2, S - 4, S - 4);
      } else if (cell.type === 'dsq') {
        const [a, b] = FAM(cell.fam);
        ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(-h, -h); ctx.lineTo(h, -h); ctx.lineTo(-h, h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(h, -h); ctx.lineTo(h, h); ctx.lineTo(-h, h); ctx.closePath(); ctx.fill();
      } else if (cell.type === 'circle') {
        ctx.fillStyle = FAM(cell.fam)[0];
        ctx.beginPath(); ctx.arc(0, 0, h - 2, 0, 2 * Math.PI); ctx.fill();
      } else if (cell.type === 'square') {
        ctx.fillStyle = FAM(cell.fam)[1];
        ctx.fillRect(-h + 2, -h + 2, S - 4, S - 4);
      } else {
        ctx.fillStyle = FAM(cell.fam)[0];
        quarter(ctx, -h, -h, S, cell.rot);
      }
      ctx.restore();
    }
    (function render() {
      ctx.clearRect(0, 0, W, H);
      if (snapped) {
        ctx.strokeStyle = P().cellline; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.5;
        const colsN = Math.floor(W / S), x0 = (W - colsN * S) / 2;
        for (let c = 0; c <= colsN; c++) { ctx.beginPath(); ctx.moveTo(x0 + c * S, H); ctx.lineTo(x0 + c * S, H - 3 * S); ctx.stroke(); }
        for (let r = 0; r <= 3; r++) { ctx.beginPath(); ctx.moveTo(x0, H - r * S); ctx.lineTo(x0 + colsN * S, H - r * S); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      pieces.forEach(drawPiece);
      requestAnimationFrame(render);
    })();
    Runner.run(runner, engine);
    drop(8);
    window.__bin = { get pieces() { return pieces.map(p => ({ x:p.position.x, y:p.position.y, a:p.angle, static:p.isStatic })); }, get dims() { return { W, H, S }; }, get snapped() { return snapped; } };
  }
})();

/* ================= THE CELL CODE — scannable cell grid ================= */
(() => {
  const enc = $('code-canvas'); if (!enc) return;
  /*
   * Data lives in SHAPE + ROTATION; colour is purely brand (palette-independent decode).
   * quarter orientation = 2 bits per cell · 2×2 corner discs = finders ·
   * circle marker inside TL corner = orientation · payload = UTF-8 + length + CRC-16.
   */
  const SIZES = [9, 11, 13, 15, 17, 21];
  const mixHex = (h1, h2, t) => {
    const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const A = p(h1), B = p(h2);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const capacity = N => Math.floor((N * N - 36) / 4) - 3; // finders 16 + quiet rings 16 + markers 4
  const ectx = enc.getContext('2d');
  let curN = 13, curGrid = null, lastText = '';

  function crc16(bytes) {
    let crc = 0xFFFF;
    for (const b of bytes) {
      crc ^= b << 8;
      for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
    return crc;
  }
  const reserved = N => {
    /* finder 2×2 blocks + a quiet ring of empty cells around each (so the
       discs stay isolated blobs for detection) + the 4 orientation markers */
    const set = new Set(), quiet = new Set();
    const corners = [[0,0],[N-2,0],[0,N-2],[N-2,N-2]];
    corners.forEach(([cx, cy]) => {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        set.add((cy+dy) * N + cx+dx);
        for (const [ax, ay] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx+dx+ax, ny = cy+dy+ay;
          if (nx >= 0 && ny >= 0 && nx < N && ny < N && !set.has(ny * N + nx)) quiet.add(ny * N + nx);
        }
      }
    });
    [[2,2],[N-3,2],[2,N-3],[N-3,N-3]].forEach(([x,y]) => { set.add(y * N + x); quiet.delete(y * N + x); });
    return { set, quiet };
  };

  function encode(text) {
    const payload = new TextEncoder().encode(text);
    const N = SIZES.find(n => capacity(n) >= payload.length);
    if (!N) return null;
    const crc = crc16(payload);
    const bytes = [payload.length, crc >> 8, crc & 0xFF, ...payload];
    const pairs = [];
    bytes.forEach(b => { for (let k = 6; k >= 0; k -= 2) pairs.push((b >> k) & 3); });
    const { set: res, quiet } = reserved(N);
    const grid = new Array(N * N).fill(null);
    // finders: each corner 2×2 = four quarters composing a disc
    const disc = (cx, cy) => {
      grid[cy * N + cx]       = { t:'q', rot:0, fam:2 }; // mass br
      grid[cy * N + cx + 1]   = { t:'q', rot:1, fam:2 }; // mass bl
      grid[(cy+1) * N + cx]   = { t:'q', rot:3, fam:2 }; // mass tr
      grid[(cy+1) * N + cx+1] = { t:'q', rot:2, fam:2 }; // mass tl
    };
    disc(0, 0); disc(N-2, 0); disc(0, N-2); disc(N-2, N-2);
    grid[2 * N + 2]           = { t:'circle', fam:3 };           // TL marker
    grid[2 * N + (N-3)]       = { t:'square', fam:3 };
    grid[(N-3) * N + 2]       = { t:'square', fam:3 };
    grid[(N-3) * N + (N-3)]   = { t:'square', fam:3 };
    let k = 0;
    for (let i = 0; i < N * N; i++) {
      if (res.has(i)) continue;
      if (quiet.has(i)) { grid[i] = null; continue; }    // quiet ring stays empty (finder isolation)
      grid[i] = k < pairs.length
        ? { t:'q', rot:pairs[k++], fam:5 }
        : { t:'q', rot:((i * 1103515245 + 12345) >>> 16) & 3, fam:5 }; // pad to a full field — decode uses length, not a terminator
    }
    return { grid, N };
  }

  function drawCode() {
    if (!curGrid) return;
    const p = P(), N = curN;
    const w = Math.min(enc.parentElement.clientWidth, 440);
    const dpr = devicePixelRatio || 1;
    const m = w / (N + 2); // quiet zone = 1 cell
    enc.width = w * dpr; enc.height = w * dpr;
    enc.style.height = w + 'px';
    ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ectx.fillStyle = '#FFFFFF'; ectx.fillRect(0, 0, w, w);
    for (let i = 0; i < N * N; i++) {
      const cell = curGrid[i]; if (!cell) continue;
      const c = i % N, r = (i / N) | 0;
      const px = m + c * m, py = m + r * m;
      if (cell.t === 'ghost') { ectx.strokeStyle = p.cellline; ectx.lineWidth = 0.8; ectx.strokeRect(px + m*0.2, py + m*0.2, m*0.6, m*0.6); continue; }
      const [a0, b] = FAM(cell.fam);
      const a = mixHex(a0, b, 0.45);   // darken the light stop: scannability beats gradient range
      const gr = ectx.createLinearGradient(px, py, px + m, py + m);
      gr.addColorStop(0, a); gr.addColorStop(1, b);
      ectx.fillStyle = gr;
      if (cell.t === 'q') quarter(ectx, px, py, m, cell.rot);
      else if (cell.t === 'circle') cdisc(ectx, px, py, m);
      else ectx.fillRect(px, py, m, m);   // full-bleed: corners must ink for the decoder
    }
  }

  /* ---------- decoder ---------- */
  function lum(d, i) { return 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]; }

  function decodeImage(imgData) {
    const W = imgData.width, H = imgData.height, d = imgData.data;
    const L = new Float32Array(W * H);
    let lo = 255, hi = 0;
    for (let i = 0; i < W * H; i++) { const v = lum(d, i * 4); L[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi - lo < 25) return { ok:false, err:'Low contrast' };

    /* adaptive (local-mean) threshold via integral image — survives bright
       screens in dark rooms, shadows and uneven light */
    const IW = W + 1;
    const integ = new Float64Array(IW * (H + 1));
    for (let y = 0; y < H; y++) {
      let row = 0;
      for (let x = 0; x < W; x++) {
        row += L[y * W + x];
        integ[(y + 1) * IW + x + 1] = integ[y * IW + x + 1] + row;
      }
    }
    const win = Math.max(14, (Math.min(W, H) / 9) | 0);
    const adaptive = factor => {
      const out = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) {
        const y0 = Math.max(0, y - win), y1 = Math.min(H, y + win);
        for (let x = 0; x < W; x++) {
          const x0 = Math.max(0, x - win), x1 = Math.min(W, x + win);
          const m = (integ[y1 * IW + x1] - integ[y0 * IW + x1] - integ[y1 * IW + x0] + integ[y0 * IW + x0]) / ((x1 - x0) * (y1 - y0));
          out[y * W + x] = L[y * W + x] < m * factor - 2 ? 1 : 0;
        }
      }
      return out;
    };
    const thr = (lo + hi) / 2;
    const inkGlobal = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) inkGlobal[i] = L[i] < thr ? 1 : 0;

    let lastErr = 'No code found';
    /* crisp sources erode at 0.97, blurred sources erode at 0.88 — try both */
    for (const ink of [adaptive(0.88), adaptive(0.97), inkGlobal]) {
      const r = attempt(ink, W, H);
      if (r.ok) return r;
      lastErr = r.err;
    }
    return { ok:false, err:lastErr };
  }

  function attempt(ink, W, H) {
    // connected components → disc-like blobs
    const seen = new Uint8Array(W * H), blobs = [];
    const stack = new Int32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (!ink[i] || seen[i]) continue;
      let sp = 0, n = 0, sx = 0, sy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
      stack[sp++] = i; seen[i] = 1;
      while (sp) {
        const j = stack[--sp], x = j % W, y = (j / W) | 0;
        n++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && ink[j-1] && !seen[j-1]) { seen[j-1] = 1; stack[sp++] = j-1; }
        if (x < W-1 && ink[j+1] && !seen[j+1]) { seen[j+1] = 1; stack[sp++] = j+1; }
        if (y > 0 && ink[j-W] && !seen[j-W]) { seen[j-W] = 1; stack[sp++] = j-W; }
        if (y < H-1 && ink[j+W] && !seen[j+W]) { seen[j+W] = 1; stack[sp++] = j+W; }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (n < W * H / 9000 || n > W * H / 8) continue;
      const ar = bw / bh, fill = n / (bw * bh);
      if (ar > 0.6 && ar < 1.65 && fill > 0.55 && fill < 0.92)
        blobs.push({ x: sx / n, y: sy / n, n, dia: (bw + bh) / 2 });
    }
    if (blobs.length < 4) return { ok:false, err:`Found ${blobs.length}/4 corner discs` };
    blobs.sort((a, b) => b.n - a.n);
    // among the biggest blobs, take the 4 most similar in size
    const pool = blobs.slice(0, 8);
    let four = pool.slice(0, 4);
    if (pool.length > 4) {
      let best = Infinity;
      for (let i = 0; i + 3 < pool.length; i++) {
        const set = pool.slice(i, i + 4);
        const spread = set[0].n / set[3].n;
        if (spread < best) { best = spread; four = set; }
      }
    }
    const mcx = four.reduce((s, b) => s + b.x, 0) / 4, mcy = four.reduce((s, b) => s + b.y, 0) / 4;
    four.sort((a, b) => Math.atan2(a.y - mcy, a.x - mcx) - Math.atan2(b.y - mcy, b.x - mcx));
    const dia = four.reduce((s, b) => s + b.dia, 0) / 4;
    const span = Math.hypot(four[0].x - four[1].x, four[0].y - four[1].y);
    let Nest = Math.round(span / (dia / 2)) + 2;
    const candidates = [...SIZES].sort((a, b) => Math.abs(a - Nest) - Math.abs(b - Nest)).slice(0, 3);

    const sample = (Hm, gx, gy) => {
      const den = Hm[6] * gx + Hm[7] * gy + 1;
      const x = (Hm[0] * gx + Hm[1] * gy + Hm[2]) / den;
      const y = (Hm[3] * gx + Hm[4] * gy + Hm[5]) / den;
      if (x < 0 || y < 0 || x >= W || y >= H) return 0;
      return ink[(y | 0) * W + (x | 0)];
    };
    const classify = (Hm, c, r) => {
      /* Inner-ring corner sampling (22% inset) is blur-tolerant: adjacent cells
         bleed ink into the outer corners under blur, but not this deep.
         quarter ⇒ exactly 3 inner corners inked, the empty one names the rotation.
         circle & square both ink all 4 inner corners; outer corners + fill split them. */
      const K = 9, hit = [];
      let n = 0, sx = 0, sy = 0;
      for (let j = 0; j < K; j++) { hit.push([]); for (let i = 0; i < K; i++) {
        const u = (i + 0.5) / K, v = (j + 0.5) / K;
        const s = sample(Hm, c + u, r + v);
        hit[j].push(s);
        if (s) { n++; sx += u - 0.5; sy += v - 0.5; }
      } }
      const fill = n / (K * K);
      if (fill < 0.15) return { t:'empty' };
      const blockAt = (ci, cj) => {
        const di = ci < K / 2 ? 1 : -1, dj = cj < K / 2 ? 1 : -1;
        return (hit[cj][ci] + hit[cj][ci + di] + hit[cj + dj][ci] + hit[cj + dj][ci + di]) >= 3 ? 1 : 0;
      };
      const iTL = blockAt(1, 1), iTR = blockAt(K-2, 1), iBL = blockAt(1, K-2), iBR = blockAt(K-2, K-2);
      const inner = iTL + iTR + iBL + iBR;
      if (inner === 3) {
        if (!iTL) return { t:'q', rot:0, fill };
        if (!iTR) return { t:'q', rot:1, fill };
        if (!iBL) return { t:'q', rot:3, fill };
        return { t:'q', rot:2, fill };
      }
      if (inner === 4) {
        const outer = blockAt(0, 0) + blockAt(K-1, 0) + blockAt(0, K-1) + blockAt(K-1, K-1);
        return (outer >= 3 || fill > 0.9) ? { t:'square', fill } : { t:'circle', fill };
      }
      // inner ≤ 2: thin/eroded — centroid fallback
      const cx = sx / n, cy = sy / n;
      if (Math.abs(cx) + Math.abs(cy) > 0.08) return { t:'q', rot: cx > 0 ? (cy > 0 ? 0 : 3) : (cy > 0 ? 1 : 2), fill };
      return fill > 0.8 ? { t:'square', fill } : { t:'circle', fill };
    };

    for (const N of candidates) {
      const gpts = [[1,1],[N-1,1],[N-1,N-1],[1,N-1]];
      // score all 4 rotations by marker agreement; attempt reads best-first (CRC gates correctness)
      const tries = [];
      for (let rot = 0; rot < 4; rot++) {
        const ipts = [0,1,2,3].map(k => four[(k + rot) % 4]);
        const Hm = homography(gpts.map(([x, y]) => [x, y]), ipts.map(b => [b.x, b.y]));
        if (!Hm) continue;
        const marks = [[2,2],[N-3,2],[N-3,N-3],[2,N-3]].map(([x, y]) => classify(Hm, x, y).t);
        const score = (marks[0] === 'circle' ? 1 : 0) + marks.slice(1).filter(t => t === 'square').length;
        if (score >= 3) tries.push({ Hm, score });
      }
      tries.sort((a, b) => b.score - a.score);
      for (const { Hm } of tries) {
        const { set: res, quiet } = reserved(N), pairs = [];
        for (let i = 0; i < N * N; i++) {
          if (res.has(i) || quiet.has(i)) continue;
          pairs.push(classify(Hm, i % N, (i / N) | 0));
        }
        const bits = [];
        for (const cl of pairs) { if (cl.t !== 'q') break; bits.push(cl.rot); }
        if (bits.length < 12) continue;
        const byteAt = k => (bits[k*4] << 6) | (bits[k*4+1] << 4) | (bits[k*4+2] << 2) | bits[k*4+3];
        const len = byteAt(0);
        if ((3 + len) * 4 > bits.length) continue;
        const want = (byteAt(1) << 8) | byteAt(2);
        const payload = []; for (let k = 0; k < len; k++) payload.push(byteAt(3 + k));
        if (crc16(payload) !== want) continue;
        try { return { ok:true, text: new TextDecoder('utf-8', { fatal:true }).decode(new Uint8Array(payload)), N }; }
        catch { continue; }
      }
    }
    return { ok:false, err:'Discs found but no valid read. Hold flatter or closer.' };
  }

  function homography(src, dst) { // 4-point DLT, returns [h0..h7]
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [X, Y] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
    }
    // gaussian elimination
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < 8; col++) {
      let piv = col;
      for (let r = col + 1; r < 8; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-9) return null;
      [M[col], M[piv]] = [M[piv], M[col]];
      for (let r = 0; r < 8; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        for (let c = col; c < 9; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map((row, i) => row[8] / row[i]);
  }

  /* ---------- UI ---------- */
  const result = (ok, msg) => {
    const el = $('code-result');
    el.style.color = ok ? 'var(--is-green)' : 'var(--is-crimson)';
    el.textContent = msg;
  };
  function make() {
    const text = $('code-text').value || 'BDSIS JS3000';
    const e = encode(text);
    if (!e) { result(false, 'Too long. Max ~100 bytes.'); return; }
    curGrid = e.grid; curN = e.N; lastText = text;
    drawCode();
    $('code-label').textContent = `CELL CODE · ${e.N}×${e.N} · ${new TextEncoder().encode(text).length} BYTES + CRC-16`;
    result(true, '');
  }
  $('code-make').addEventListener('click', make);
  $('code-text').addEventListener('keydown', e => { if (e.key === 'Enter') make(); });
  const RAND_TEXTS = ['BDSIS JS3000', 'The few, for the many', 'Humans × Technology',
    'Elite is the duty, not the reward', 'Interdisciplinary Studies', 'PolyU · 香港理工大學',
    '跨學科組合學士課程', 'One of one', 'Train builders, not bystanders', 'Class of 2025'];
  mkRand($('code-make'), () => {
    $('code-text').value = RAND_TEXTS[randInt(RAND_TEXTS.length)];
    make();
  }, { aria:'Encode a random brand phrase' });
  REPAINT.push(drawCode);

  $('code-selftest').addEventListener('click', () => {
    const r = decodeImage(ectx.getImageData(0, 0, enc.width, enc.height));
    result(r.ok, r.ok ? `✓ Decoded: "${r.text}"` : '✗ ' + r.err);
  });
  $('code-upload').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0, c.width, c.height);
      const r = decodeImage(cx.getImageData(0, 0, c.width, c.height));
      result(r.ok, r.ok ? `✓ Decoded: "${r.text}"` : '✗ ' + r.err);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  });

  let camStream = null, camTimer = null;
  async function stopScan() {
    clearInterval(camTimer); camTimer = null;
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    $('code-scan').textContent = 'Scan with camera';
    $('code-video').style.display = 'none';
  }
  $('code-scan').addEventListener('click', async () => {
    if (camStream) { stopScan(); return; }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ ideal:1280 } }, audio:false });
      const v = $('code-video');
      v.srcObject = camStream; v.style.display = 'block'; await v.play();
      $('code-scan').textContent = 'Stop scanning';
      const c = document.createElement('canvas'), cx = c.getContext('2d', { willReadFrequently:true });
      camTimer = setInterval(() => {
        if (v.readyState < 2) return;
        const k = Math.min(1, 900 / Math.max(v.videoWidth, v.videoHeight));
        c.width = v.videoWidth * k; c.height = v.videoHeight * k;
        cx.drawImage(v, 0, 0, c.width, c.height);
        const r = decodeImage(cx.getImageData(0, 0, c.width, c.height));
        if (r.ok) { result(true, `✓ Decoded: "${r.text}"`); stopScan(); }
        else result(false, '… ' + r.err);
      }, 420);
    } catch { result(false, 'Camera unavailable or permission declined.'); }
  });
  addEventListener('pagehide', stopScan);

  /* vector version of the rendered code (1-cell quiet zone, darkened stop to match drawCode) */
  function codeToSVG() {
    if (!curGrid) return '';
    const N = curN, u = 100, W = (N + 2) * u, p = P();
    let defs = '';
    for (let f = 1; f <= 5; f++) {
      const [a0, b] = p.fams[f - 1], a = mixHex(a0, b, 0.45);
      defs += `<linearGradient id="cf${f}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
    }
    const PD = (x, y) => ({
      0: `M${x+u},${y} A${u},${u} 0 0,0 ${x},${y+u} L${x+u},${y+u} Z`,
      1: `M${x},${y} A${u},${u} 0 0,1 ${x+u},${y+u} L${x},${y+u} Z`,
      2: `M${x+u},${y} A${u},${u} 0 0,1 ${x},${y+u} L${x},${y} Z`,
      3: `M${x+u},${y+u} A${u},${u} 0 0,1 ${x},${y} L${x+u},${y} Z`,
    });
    const parts = [`<rect x="0" y="0" width="${W}" height="${W}" fill="#FFFFFF"/>`];
    for (let i = 0; i < N * N; i++) {
      const cell = curGrid[i]; if (!cell || cell.t === 'ghost') continue;
      const x = ((i % N) + 1) * u, y = (((i / N) | 0) + 1) * u, g = `url(#cf${cell.fam})`;
      if (cell.t === 'q') parts.push(`<path d="${PD(x, y)[cell.rot]}" fill="${g}"/>`);
      else if (cell.t === 'circle') parts.push(`<circle cx="${x+u/2}" cy="${y+u/2}" r="${u/2}" fill="${g}"/>`);
      else parts.push(`<rect x="${x}" y="${y}" width="${u}" height="${u}" fill="${g}"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">\n<defs>${defs}</defs>\n${parts.join('')}\n</svg>`;
  }
  attachSaveMenu(enc, {
    title: 'Cell Code',
    svg: codeToSVG,
    name: () => 'bdsis-code',
    size: () => { const W = (curN + 2) * 60; return [W, W]; },
  });

  window.__code = { encode, decodeImage, codeToSVG, get canvas() { return enc; } };
  make();
})();
