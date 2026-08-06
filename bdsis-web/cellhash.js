/* Cell-grid hash — the Lab's "Your Mark" generator, applied to print, and the
   live editing that drives it.

   Same pipeline as Exhibit 4: cyrb128 hashes the holder's name to 128 bits,
   and an sfc32 stream then lays out every cell in reading order. The same name
   always produces the same field, so a mark generated in the Lab and a mark
   printed on a card are the same artwork.

   Output is inline SVG rather than canvas. The PDF export clones the artifact
   and hands it to the browser's print pipeline, where only real paths survive
   as vector — a canvas would land in Illustrator as a flat bitmap, which is
   the failure §02 warns about. */
(() => {
  'use strict';

  /* cyrb128 / sfc32, unchanged from lab.js. Any edit here breaks parity with
     the Lab tool, which is the whole point of using them. */
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

  /* The four families at their print values, each with its own gradient
     direction from §02. The Lab runs every gradient corner to corner; on paper
     the documented angle is the one that ships, so it is used here.
     `v` is the objectBoundingBox vector [x1, y1, x2, y2]; `ink` is the family's
     text-safe darkening from §07, for type that has to sit beside the field. */
  const FAM = [
    { name: 'Red',       a: '#A02337', b: '#861C2C', v: [0, 0, 1, 0], css: '90deg',  ink: '#A02337' },
    { name: 'Tangerine', a: '#F2A03B', b: '#E14729', v: [0, 1, 1, 0], css: '45deg',  ink: '#B8390F' },
    { name: 'Olive',     a: '#C2C684', b: '#A8B468', v: [0, 0, 1, 1], css: '135deg', ink: '#5F6733' },
    { name: 'Ocean',     a: '#54ABBB', b: '#3A8FA3', v: [0, 0, 0, 1], css: '180deg', ink: '#2C7183' },
  ];

  /* The dark registers.

     dark: the four families relit for a dark ground, exactly the values §14
     gives the Dark theme. Same hues, raised in value and softened in
     saturation, and both stops of every family clear 4.5:1 on the stock, which
     is why they double as the text colours and need no separate ink variants.
     gold: the four values §07 already specifies for Dark Mono Gold. A single
     plate cannot carry a family gradient (§02), so those four are depths of
     one metal rather than four hues. */
  const DARK = [
    { a: '#F2778C', b: '#DB5670', v: [0, 0, 1, 0], css: '90deg',  ink: '#F2778C' },   /* Red       */
    { a: '#F5A85A', b: '#EE8340', v: [0, 1, 1, 0], css: '45deg',  ink: '#F5A85A' },   /* Tangerine */
    { a: '#C9CE8C', b: '#ADB878', v: [0, 0, 1, 1], css: '135deg', ink: '#C9CE8C' },   /* Olive     */
    { a: '#7FC9D8', b: '#58A9BC', v: [0, 0, 0, 1], css: '180deg', ink: '#7FC9D8' },   /* Ocean     */
  ];
  const GOLD = [
    { a: '#F0D08A', b: '#C9A227', v: [0, 0, 1, 0], css: '90deg',  ink: '#F0D08A' },   /* Gold      */
    { a: '#C9A227', b: '#96741A', v: [0, 1, 1, 0], css: '45deg',  ink: '#C9A227' },   /* Antique   */
    { a: '#F7E3B5', b: '#E0C878', v: [0, 0, 1, 1], css: '135deg', ink: '#F7E3B5' },   /* Champagne */
    { a: '#D9B84A', b: '#96741A', v: [0, 0, 0, 1], css: '180deg', ink: '#D9B84A' },   /* Gold Ink  */
  ];
  const PALETTE = { brand: FAM, dark: DARK, gold: GOLD };

  const U = 100;   /* lattice unit; the SVG is scaled to millimetres by CSS */

  /* Quarter disc, by rotation. 0 bulges top-left, then clockwise. */
  const QUARTER = (x, y) => [
    `M${x + U},${y} A${U},${U} 0 0,0 ${x},${y + U} L${x + U},${y + U} Z`,
    `M${x},${y} A${U},${U} 0 0,1 ${x + U},${y + U} L${x},${y + U} Z`,
    `M${x + U},${y} A${U},${U} 0 0,1 ${x},${y + U} L${x},${y} Z`,
    `M${x + U},${y + U} A${U},${U} 0 0,1 ${x},${y} L${x + U},${y} Z`,
  ];

  /* `lead` overrides the family the hash would have chosen. The accent is
     always nudged off the lead so the two never collapse into one colour. */
  function field(text, cols, rows, idp, lead, pal, accent) {
    const P = PALETTE[pal] || FAM;
    const s = cyrb128(text);
    const rnd = sfc32(s[0], s[1], s[2], s[3]);
    if (lead === null || lead === undefined) lead = s[0] % 4;
    /* A derived accent is nudged off the lead so the field always has two
       tones. An accent chosen deliberately is left alone, including when it
       matches the lead, which is how a single-family field is asked for. */
    if (accent === null || accent === undefined) {
      accent = s[1] % 4; if (accent === lead) accent = (lead + 1) % 4;
    }

    const parts = [];
    for (let i = 0; i < cols * rows; i++) {
      /* Three draws per cell, in this order, so the stream matches the Lab. */
      const roll = rnd(), famRoll = rnd(), rotRoll = rnd();
      const f = famRoll < 0.12 ? accent : lead;
      const x = (i % cols) * U, y = ((i / cols) | 0) * U;
      const g = `url(#${idp}${f})`;
      if (roll < 0.50)      parts.push(`<path d="${QUARTER(x, y)[(rotRoll * 4) | 0]}" fill="${g}"/>`);
      else if (roll < 0.66) parts.push(
        `<path d="M${x},${y} L${x + U},${y} L${x},${y + U} Z" fill="${P[f].a}"/>`,
        `<path d="M${x + U},${y} L${x + U},${y + U} L${x},${y + U} Z" fill="${P[f].b}"/>`);
      else if (roll < 0.78) parts.push(`<circle cx="${x + U / 2}" cy="${y + U / 2}" r="${U / 2}" fill="${g}"/>`);
      else if (roll < 0.88) parts.push(`<rect x="${x}" y="${y}" width="${U}" height="${U}" fill="${g}"/>`);
      /* the remaining 12% stay empty, and the stock shows through */
    }

    const defs = P.map((f, n) =>
      `<linearGradient id="${idp}${n}" x1="${f.v[0]}" y1="${f.v[1]}" x2="${f.v[2]}" y2="${f.v[3]}">` +
      `<stop offset="0" stop-color="${f.a}"/><stop offset="1" stop-color="${f.b}"/></linearGradient>`).join('');

    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * U} ${rows * U}" ` +
           `preserveAspectRatio="none" aria-hidden="true"><defs>${defs}</defs>${parts.join('')}</svg>`,
      tag: s[0].toString(16).padStart(8, '0').toUpperCase(),
      lead, accent,
    };
  }

  /* Repaint one field from its own data attributes. Called on load and on
     every keystroke in the name it is bound to. */
  const seen = new Map();
  function paint(host) {
    if (!seen.has(host)) seen.set(host, `h${seen.size}f`);
    const idp = seen.get(host);
    const num = v => (v === '' || v === undefined) ? null : parseInt(v, 10);
    const lead = num(host.dataset.hashLead);
    const accent = num(host.dataset.hashAccent);
    const pal = host.dataset.hashPalette || 'brand';
    const P = PALETTE[pal] || FAM;
    const res = field(
      host.dataset.hash || ' ',
      parseInt(host.dataset.hashCols, 10) || 17,
      parseInt(host.dataset.hashRows, 10) || 7,
      idp, lead, pal, accent);
    host.innerHTML = res.svg;
    host.dataset.hashTagValue = res.tag;
    /* Type that has to hold its own beside the field follows the lead family
       into its text-safe darkening, never the flat family value. */
    document.querySelectorAll(`[data-hash-ink="${host.id}"]`)
      .forEach(el => el.style.color = P[res.lead].ink);
    /* A flat band that has to agree with the field takes the lead family's
       own gradient, at the angle §02 gives it. */
    document.querySelectorAll(`[data-hash-grad="${host.id}"]`)
      .forEach(el => el.style.background = `linear-gradient(${P[res.lead].css}, ${P[res.lead].a}, ${P[res.lead].b})`);
    document.querySelectorAll(`[data-hash-tag="${host.id}"]`)
      .forEach(el => el.textContent = res.tag);
    return res;
  }

  const fields = [...document.querySelectorAll('[data-hash]')];
  fields.forEach(paint);

  /* ── Live editing ──────────────────────────────────────────────────────
     The pieces are edited in place rather than through a form: a card is a
     layout, and typing into the layout is the only way to find out that a
     long name pushes into the safety margin. */
  document.querySelectorAll('[data-edit]').forEach(el => {
    /* plaintext-only keeps pasted markup out of a piece that gets cloned
       into the PDF. Where it is unsupported, fall back to plain editing. */
    el.contentEditable = 'plaintext-only';
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.spellcheck = false;
    /* Every field here is a single line; Enter would silently add a second. */
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('input', () => {
      /* The dark registers show the same person, so their copy follows the
         one editable original rather than being separately editable. */
      document.querySelectorAll(`[data-mirror="${el.id}"]`)
        .forEach(m => m.textContent = el.textContent);
      fields.filter(f => f.dataset.hashFrom === el.id).forEach(f => {
        f.dataset.hash = el.textContent.trim();
        paint(f);
      });
    });
  });

  /* ── Family picker ─────────────────────────────────────────────────────
     Auto means "whatever the name hashed to". Choosing a family overrides
     only the lead; the layout itself stays keyed to the name.

     `data-fam-pick` takes every field of the piece, light and dark alike, so
     one control moves all of a piece's registers together. The choice is a
     family SLOT rather than a literal colour, and each register renders that
     slot in its own ink: slot 0 is Red on the light card, the relit Red on the
     dark one, and Gold in the ceremonial register. */
  document.querySelectorAll('[data-fam-pick]').forEach(bar => {
    const hosts = bar.dataset.famPick.split(/\s+/)
      .map(id => document.getElementById(id)).filter(Boolean);
    if (!hosts.length) return;
    /* Two bars per piece: one sets the family that leads the field, one sets
       the family that appears in roughly one cell in eight. */
    const key = bar.dataset.famRole === 'accent' ? 'hashAccent' : 'hashLead';
    bar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        hosts.forEach(host => {
          if (btn.dataset.fam === 'auto') delete host.dataset[key];
          else host.dataset[key] = btn.dataset.fam;
          paint(host);
        });
        bar.querySelectorAll('button').forEach(b => {
          b.classList.toggle('on', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
      });
    });
  });

  window.CellHash = { FAM, field, paint };
})();
