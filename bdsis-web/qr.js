/* QR codes, encoded here rather than fetched from a service.

   A QR code on a poster is brand artwork: it has to be vector, it has to
   survive a printer, and it must not depend on some third party's endpoint
   still existing in three years. So this is a complete encoder to ISO/IEC
   18004 — byte mode, versions 1 to 40, all four error-correction levels —
   plus a renderer that draws the result in the house shapes.

   Everything below is the published algorithm. The only opinions are in the
   rendering: module shape, the treatment of the three finder eyes, and the
   centre mark. Those never touch the module grid itself, which is what a
   scanner reads. */
(() => {
  'use strict';

  /* ── GF(256), the field QR arithmetic lives in ─────────────────────────
     Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 = 0x11D. */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  /* ── Reed–Solomon ──────────────────────────────────────────────────────
     The generator polynomial is the product of (x - a^i) for i in 0..deg-1,
     coefficients written highest power first. */
  const polyMul = (a, b) => {
    const r = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++) r[i + j] ^= gmul(a[i], b[j]);
    return r;
  };
  const genCache = new Map();
  function rsGenerator(degree) {
    if (genCache.has(degree)) return genCache.get(degree);
    let p = [1];
    for (let i = 0; i < degree; i++) p = polyMul(p, [1, EXP[i]]);
    genCache.set(degree, p);
    return p;
  }
  /* Remainder of data(x) * x^deg divided by gen(x). */
  function rsRemainder(data, gen) {
    const res = new Array(gen.length - 1).fill(0);
    for (const b of data) {
      const factor = b ^ res[0];
      res.shift(); res.push(0);
      for (let i = 0; i < res.length; i++) res[i] ^= gmul(gen[i + 1], factor);
    }
    return res;
  }

  /* ── The two tables the standard does not let you derive ──────────────
     Index is the version, 1 to 40. Everything else about capacity comes out
     of the module-count formula below. */
  const ECC_PER_BLOCK = {
    L: [0,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    M: [0,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    Q: [0,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    H: [0,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  };
  const NUM_BLOCKS = {
    L: [0,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    M: [0,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    Q: [0,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    H: [0,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81],
  };
  const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };   /* the two-bit field code */

  /* Total modules available to data and ECC, before any of it is used. */
  function rawDataModules(ver) {
    let n = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      n -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) n -= 36;
    }
    return n;
  }
  const totalCodewords = ver => Math.floor(rawDataModules(ver) / 8);
  const dataCodewords = (ver, ecl) =>
    totalCodewords(ver) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];

  /* Ascending, and 6 must stay first: the caller skips index 0 and the last
     index to keep alignment patterns off the three finders, so an out-of-order
     list stamps one straight through the top-left eye. */
  function alignPositions(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const pos = [6];
    for (let p = ver * 4 + 10; pos.length < n; p -= step) pos.splice(1, 0, p);
    return pos;
  }

  /* ── Data encoding, byte mode ─────────────────────────────────────────
     Byte mode rather than alphanumeric: a URL contains lower case and a
     colon, neither of which the alphanumeric set has. */
  const utf8 = str => [...new TextEncoder().encode(str)];
  const charCountBits = ver => ver < 10 ? 8 : 16;

  function chooseVersion(byteLen, ecl) {
    for (let ver = 1; ver <= 40; ver++) {
      const capacity = dataCodewords(ver, ecl) * 8;
      if (4 + charCountBits(ver) + byteLen * 8 <= capacity) return ver;
    }
    return null;
  }

  function encodeData(bytes, ver, ecl) {
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0b0100, 4);                       /* byte mode */
    push(bytes.length, charCountBits(ver));
    for (const b of bytes) push(b, 8);

    const capacity = dataCodewords(ver, ecl) * 8;
    push(0, Math.min(4, capacity - bits.length));      /* terminator */
    while (bits.length % 8 !== 0) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    /* The two pad codewords alternate until the block is full. */
    for (let pad = 0xEC; cw.length < capacity / 8; pad ^= 0xEC ^ 0x11) cw.push(pad);
    return cw;
  }

  /* Split into blocks, add ECC to each, then interleave as the standard
     requires: all first data codewords, then all seconds, and so on. */
  function interleave(data, ver, ecl) {
    const numBlocks = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver];
    const total = totalCodewords(ver);
    const shortLen = Math.floor(total / numBlocks) - eccLen;
    const numShort = numBlocks - total % numBlocks;
    const gen = rsGenerator(eccLen);

    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const len = shortLen + (i < numShort ? 0 : 1);
      const dat = data.slice(k, k + len); k += len;
      blocks.push({ dat, ecc: rsRemainder(dat, gen) });
    }
    const out = [];
    for (let i = 0; i <= shortLen; i++)
      for (const b of blocks) if (i < b.dat.length) out.push(b.dat[i]);
    for (let i = 0; i < eccLen; i++)
      for (const b of blocks) out.push(b.ecc[i]);
    return out;
  }

  /* ── The module grid ──────────────────────────────────────────────────
     `fn` marks every module placed by a function pattern, which is what the
     data-placement walk and the mask both have to skip. */
  function newMatrix(ver) {
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Uint8Array(size));
    const fn  = Array.from({ length: size }, () => new Uint8Array(size));
    return { size, mod, fn, ver };
  }
  const setFn = (m, x, y, dark) => {
    if (x < 0 || y < 0 || x >= m.size || y >= m.size) return;
    m.mod[y][x] = dark ? 1 : 0; m.fn[y][x] = 1;
  };

  function drawFunctionPatterns(m) {
    const { size } = m;
    for (let i = 0; i < size; i++) {           /* timing */
      setFn(m, 6, i, i % 2 === 0);
      setFn(m, i, 6, i % 2 === 0);
    }
    /* Finder plus its separator, as one 9x9 stamp per corner. */
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          setFn(m, cx + dx, cy + dy, d !== 2 && d !== 4);
        }
    /* Alignment, everywhere except under the three finders. */
    const pos = alignPositions(m.ver);
    for (let i = 0; i < pos.length; i++)
      for (let j = 0; j < pos.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) ||
            (i === pos.length - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            setFn(m, pos[j] + dx, pos[i] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    /* Reserve the format area now; the real bits go in once the mask is known. */
    drawFormat(m, 'L', 0, true);
    if (m.ver >= 7) drawVersion(m);
  }

  function drawFormat(m, ecl, mask, reserveOnly) {
    const data = (ECL_BITS[ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const { size } = m;
    const bit = i => reserveOnly ? false : ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setFn(m, 8, i, bit(i));
    setFn(m, 8, 7, bit(6));
    setFn(m, 8, 8, bit(7));
    setFn(m, 7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(m, 14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(m, size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(m, 8, size - 15 + i, bit(i));
    setFn(m, 8, size - 8, true);                  /* the always-dark module */
  }

  function drawVersion(m) {
    let rem = m.ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (m.ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = m.size - 11 + i % 3, b = Math.floor(i / 3);
      setFn(m, a, b, dark); setFn(m, b, a, dark);
    }
  }

  /* Zigzag up and down two columns at a time, right to left, skipping the
     vertical timing column. */
  function placeCodewords(m, cw) {
    let i = 0;
    for (let right = m.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < m.size; v++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? m.size - 1 - v : v;
          if (m.fn[y][x]) continue;
          m.mod[y][x] = i < cw.length * 8 ? (cw[i >>> 3] >>> (7 - (i & 7))) & 1 : 0;
          i++;
        }
      }
    }
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
  ];
  const applyMask = (m, k) => {
    for (let y = 0; y < m.size; y++)
      for (let x = 0; x < m.size; x++)
        if (!m.fn[y][x] && MASKS[k](x, y)) m.mod[y][x] ^= 1;
  };

  /* The four penalty rules, scored so the least patterned mask wins. */
  function penalty(m) {
    const { size, mod } = m;
    let score = 0;
    const run = line => {
      let n = 1, s = 0;
      for (let i = 1; i < size; i++) {
        if (line[i] === line[i - 1]) { n++; if (n === 5) s += 3; else if (n > 5) s++; }
        else n = 1;
      }
      return s;
    };
    for (let y = 0; y < size; y++) score += run(mod[y]);
    for (let x = 0; x < size; x++) score += run(Array.from({ length: size }, (_, y) => mod[y][x]));

    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size - 1; x++) {
        const v = mod[y][x];
        if (v === mod[y][x + 1] && v === mod[y + 1][x] && v === mod[y + 1][x + 1]) score += 3;
      }

    /* 1:1:3:1:1 with four light modules on either side, in both directions. */
    const FIND = [1,0,1,1,1,0,1];
    const hasFinderLike = (get, at) => {
      for (let i = 0; i < 7; i++) if (get(at + i) !== FIND[i]) return false;
      const before = [at - 4, at - 3, at - 2, at - 1].every(i => get(i) === 0);
      const after  = [at + 7, at + 8, at + 9, at + 10].every(i => get(i) === 0);
      return before || after;
    };
    for (let y = 0; y < size; y++) {
      const get = i => (i < 0 || i >= size) ? 0 : mod[y][i];
      for (let x = 0; x <= size - 7; x++) if (hasFinderLike(get, x)) score += 40;
    }
    for (let x = 0; x < size; x++) {
      const get = i => (i < 0 || i >= size) ? 0 : mod[i][x];
      for (let y = 0; y <= size - 7; y++) if (hasFinderLike(get, y)) score += 40;
    }

    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) dark += mod[y][x];
    const pct = dark * 100 / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  /* ── Public: text in, module grid out ─────────────────────────────────── */
  function encode(text, ecl) {
    ecl = ECL_BITS[ecl] !== undefined ? ecl : 'M';
    const bytes = utf8(text);
    const ver = chooseVersion(bytes.length, ecl);
    if (!ver) throw new Error('Too long for a QR code at error-correction level ' + ecl);
    const cw = interleave(encodeData(bytes, ver, ecl), ver, ecl);

    const m = newMatrix(ver);
    drawFunctionPatterns(m);
    placeCodewords(m, cw);

    let best = null;
    for (let k = 0; k < 8; k++) {
      applyMask(m, k);
      drawFormat(m, ecl, k, false);
      const s = penalty(m);
      if (best === null || s < best.score) best = { score: s, mask: k, mod: m.mod.map(r => r.slice()) };
      applyMask(m, k);                       /* masking is its own inverse */
    }
    m.mod = best.mod;
    return { size: m.size, version: ver, ecl, mask: best.mask,
             modules: m.mod, isDark: (x, y) => m.mod[y][x] === 1,
             isFunction: (x, y) => m.fn[y][x] === 1 };
  }

  /* ── Rendering ────────────────────────────────────────────────────────
     The grid is sacred; only the shape drawn inside each cell is ours. Every
     option here is tested to still scan, and the constraints are in §09. */
  const FAM_INK = {
    red:       '#A02337',
    tangerine: '#B8390F',
    olive:     '#5F6733',
    ocean:     '#2C7183',
    ink:       '#14110E',
    paper:     '#F8F2E7',
  };

  /* Rounded rectangle as a path, so it can be combined with a second subpath
     and an even-odd fill to make a ring. `rx` on a <path> is silently ignored,
     which is how the first version of this ended up with square eyes. */
  const rr = (x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (r === 0) return `M${x},${y}h${w}v${h}h${-w}z`;
    const a = `a${r},${r} 0 0 1 `;
    return `M${x + r},${y}h${w - 2 * r}${a}${r},${r}` +
           `v${h - 2 * r}${a}${-r},${r}` +
           `h${-(w - 2 * r)}${a}${-r},${-r}` +
           `v${-(h - 2 * r)}${a}${r},${-r}z`;
  };

  function toSVG(qr, opts = {}) {
    const o = Object.assign({
      style: 'soft',        /* square | soft | dot */
      ink: '#14110E',
      eyes: null,           /* second colour for the three finders; null = same */
      paper: 'transparent',
      quiet: 4,             /* modules; 4 is the standard minimum */
      mark: false,          /* knock a hole for the programme mark */
    }, opts);
    const eyeInk = o.eyes || o.ink;

    const n = qr.size, q = o.quiet, dim = n + q * 2;
    /* The knockout is a whole number of modules so it never clips one in half. */
    let hole = null;
    if (o.mark) {
      const h = Math.max(3, Math.round(n * 0.22) | 1);      /* odd, so it centres */
      const s = Math.floor((n - h) / 2);
      hole = { x: s, y: s, w: h, h };
    }
    const inHole = (x, y) => hole && x >= hole.x && x < hole.x + hole.w && y >= hole.y && y < hole.y + hole.h;

    const parts = [];
    if (o.paper !== 'transparent') parts.push(`<rect width="${dim}" height="${dim}" fill="${o.paper}"/>`);

    /* The three eyes are drawn as shapes, not as 49 modules, so they can take
       the house corner without disturbing the grid they sit on. The ring is one
       path with an even-odd hole, which keeps its thickness at exactly one
       module however far the corners are pulled in.

       1.6 of 7 is about as round as the ring goes: a scanner finds an eye by
       the 1:1:3:1:1 run along a line through its centre, and that run is
       untouched by rounding until the corners start eating the arms. */
    const eye = (cx, cy) => {
      const X = cx + q, Y = cy + q;
      const ro = o.style === 'square' ? 0 : 1.6;
      parts.push(
        `<path d="${rr(X, Y, 7, 7, ro)} ${rr(X + 1, Y + 1, 5, 5, Math.max(0, ro - 1))}" ` +
        `fill="${eyeInk}" fill-rule="evenodd"/>`,
        `<path d="${rr(X + 2, Y + 2, 3, 3, ro ? 1 : 0)}" fill="${eyeInk}"/>`);
    };
    const isEye = (x, y) =>
      (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!qr.isDark(x, y) || isEye(x, y) || inHole(x, y)) continue;
        const X = x + q, Y = y + q;
        if (o.style === 'dot')       parts.push(`<circle cx="${X + 0.5}" cy="${Y + 0.5}" r="0.45" fill="${o.ink}"/>`);
        else if (o.style === 'soft') parts.push(`<rect x="${X + 0.04}" y="${Y + 0.04}" width="0.92" height="0.92" rx="0.42" fill="${o.ink}"/>`);
        else                         parts.push(`<rect x="${X}" y="${Y}" width="1" height="1" fill="${o.ink}"/>`);
      }
    }
    eye(0, 0); eye(n - 7, 0); eye(0, n - 7);

    let markup = '';
    if (hole) {
      const X = hole.x + q, Y = hole.y + q;
      markup =
        `<rect x="${X}" y="${Y}" width="${hole.w}" height="${hole.h}" fill="${o.paper === 'transparent' ? '#F8F2E7' : o.paper}"/>` +
        `<image href="assets/mark-mono.svg" x="${X + hole.w * 0.16}" y="${Y + hole.h * 0.16}" ` +
        `width="${hole.w * 0.68}" height="${hole.h * 0.68}" preserveAspectRatio="xMidYMid meet"/>`;
    }

    /* Square modules want crisp edges so the grid stays even at small sizes.
       The rounded and dot styles are curves, and crispEdges would alias them
       into something a scanner likes less than the antialiased version. */
    const rendering = o.style === 'square' ? 'crispEdges' : 'geometricPrecision';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
           `shape-rendering="${rendering}" role="img" aria-label="QR code">` +
           parts.join('') + markup + `</svg>`;
  }

  /* Proportion of the code the centre mark covers. Above about a tenth the
     error correction is being spent on decoration rather than on damage. */
  const holeShare = qr => {
    const h = Math.max(3, Math.round(qr.size * 0.22) | 1);
    return (h * h) / (qr.size * qr.size);
  };

  window.QR = { encode, toSVG, FAM_INK, holeShare, dataCodewords, totalCodewords };

  /* ── Static instances on the page ─────────────────────────────────────── */
  const paint = host => {
    try {
      const qr = encode(host.dataset.qr, (host.dataset.qrEcl || 'M').toUpperCase());
      host.innerHTML = toSVG(qr, {
        style: host.dataset.qrStyle || 'soft',
        ink: FAM_INK[host.dataset.qrInk] || host.dataset.qrInk || '#14110E',
        eyes: host.dataset.qrEyes ? (FAM_INK[host.dataset.qrEyes] || host.dataset.qrEyes) : null,
        paper: host.dataset.qrPaper || 'transparent',
        quiet: parseInt(host.dataset.qrQuiet, 10) || 4,
        mark: host.dataset.qrMark === '1',
      });
      host.dataset.qrVersion = qr.version;
      host.dataset.qrMaskUsed = qr.mask;
    } catch (e) {
      host.textContent = e.message;
    }
  };
  document.querySelectorAll('[data-qr]').forEach(paint);
  window.QR.paint = paint;

  /* ── The generator in §09 ─────────────────────────────────────────────── */
  const stage = document.getElementById('qrg-stage');
  if (!stage) return;

  /* Two colours by default: the data in ink, the three eyes in Red. The eyes
     are the only part of a code a reader looks at directly, so they are where
     the brand goes. */
  const state = { text: 'https://www.polyu.edu.hk/cus/', ecl: 'M', style: 'soft',
                  ink: 'ink', eyes: 'red', mark: '0' };
  const $ = id => document.getElementById(id);
  let current = null;

  const draw = () => {
    const readout = $('qrg-readout');
    /* A centre mark spends error correction, so the level is raised with it
       rather than letting someone quietly ship a fragile code. */
    const ecl = state.mark === '1' && 'LM'.includes(state.ecl) ? 'H' : state.ecl;
    try {
      current = encode(state.text || ' ', ecl);
      stage.innerHTML = toSVG(current, {
        style: state.style, ink: FAM_INK[state.ink],
        eyes: state.eyes === 'same' ? null : FAM_INK[state.eyes],
        paper: '#F8F2E7', quiet: 4, mark: state.mark === '1',
      });
      const share = state.mark === '1' ? holeShare(current) * 100 : 0;
      readout.textContent =
        `Version ${current.version} · ${current.size} × ${current.size} modules · level ${ecl} · mask ${current.mask}` +
        (state.eyes === 'same' ? ' · one ink' : ' · two inks') +
        (share ? ` · centre mark covers ${share.toFixed(1)}% of the area` : '') +
        (ecl !== state.ecl ? ` · raised from ${state.ecl}, a centre mark needs H` : '');
      readout.classList.remove('is-error');
    } catch (e) {
      stage.innerHTML = '';
      readout.textContent = e.message;
      readout.classList.add('is-error');
      current = null;
    }
  };

  $('qrg-text').addEventListener('input', e => { state.text = e.target.value; draw(); });
  [['qrg-ecl', 'ecl'], ['qrg-style', 'style'], ['qrg-ink', 'ink'],
   ['qrg-eyes', 'eyes'], ['qrg-mark', 'mark']].forEach(([id, key]) => {
    const bar = $(id);
    bar.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      state[key] = btn.dataset.v;
      bar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      draw();
    }));
  });

  const save = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const fileName = ext => 'bdsis-qr-v' + (current ? current.version : 0) + '-' + state.ecl.toLowerCase() + '.' + ext;

  $('qrg-svg').addEventListener('click', () => {
    if (!current) return;
    save(new Blob([stage.innerHTML], { type: 'image/svg+xml' }), fileName('svg'));
  });

  /* Copy rather than download, for pasting straight into Illustrator or a
     template. The button reports back, since a silent clipboard write looks
     like nothing happened. */
  const copyBtn = $('qrg-copy');
  copyBtn.addEventListener('click', () => {
    if (!current || !navigator.clipboard) return;
    navigator.clipboard.writeText(stage.innerHTML).then(() => {
      const was = copyBtn.textContent;
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('is-done');
      setTimeout(() => { copyBtn.textContent = was; copyBtn.classList.remove('is-done'); }, 1400);
    }, () => {
      copyBtn.textContent = 'Copy blocked';
      setTimeout(() => copyBtn.textContent = 'Copy SVG', 1400);
    });
  });
  /* PNG at 8 device pixels per module, which is past what any scanner needs
     and still small enough to email. */
  $('qrg-png').addEventListener('click', () => {
    if (!current) return;
    const dim = (current.size + 8) * 8;
    const img = new Image();
    const svg = new Blob([stage.innerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svg);
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = dim;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#F8F2E7'; ctx.fillRect(0, 0, dim, dim);
      ctx.drawImage(img, 0, 0, dim, dim);
      cv.toBlob(b => save(b, fileName('png')));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  draw();
})();
