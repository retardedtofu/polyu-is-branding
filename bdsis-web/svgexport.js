/* SVG export for the print artifacts.

   The PDF path in export.js hands the DOM to the browser's print pipeline.
   This one serialises a piece to SVG directly, which is what a printer or a
   designer actually wants: real millimetres, live text, vector artwork, and
   the trim, bleed and safety lines drawn as a layer that can be deleted.

   The whole thing rests on one property of the artifact CSS: inside an
   .artifact, 1em === 1mm. So the element's own width in pixels divided by its
   width in millimetres is the only scale factor needed, and every measurement
   taken off the live DOM converts straight to millimetres. */
(() => {
  'use strict';

  /* Trim size in mm, keyed by the piece's modifier class. */
  const TRIM = {
    'artifact--a4': [210, 297], 'artifact--card': [90, 54], 'artifact--id': [85.6, 54],
    'artifact--tag': [100, 55], 'artifact--panel': [850, 2000],
  };
  const BLEED = 3;   /* mm added on every edge  */
  const SAFE = 8;    /* mm inside the trim      */

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const qt = s => esc(s).replace(/"/g, '&quot;');
  const n = v => Math.round(v * 1000) / 1000;
  const n6 = v => Math.round(v * 1e6) / 1e6;

  /* ── assets ────────────────────────────────────────────────────────────
     Every <img> and every CSS mask points at an SVG in assets/. Each is
     fetched once and parsed, then cloned per use. */
  const assets = new Map();
  const asset = url => {
    if (!assets.has(url)) {
      assets.set(url, fetch(url)
        .then(r => r.ok ? r.text() : Promise.reject(new Error(r.status + ' ' + url)))
        .then(t => new DOMParser().parseFromString(t, 'image/svg+xml').documentElement));
    }
    return assets.get(url);
  };

  let uid = 0;

  /* Ids inside an asset are global once it is inlined, so every copy gets its
     own prefix. Without this the second gradient of the same name wins and
     half the marks come out the wrong colour. */
  const REF = ['fill', 'stroke', 'clip-path', 'mask', 'filter'];
  const namespace = (root, p) => {
    root.querySelectorAll('[id]').forEach(d => {
      const was = d.id, now = p + was, from = 'url(#' + was + ')', to = 'url(#' + now + ')';
      d.id = now;
      root.querySelectorAll('*').forEach(e => {
        REF.forEach(a => {
          const v = e.getAttribute(a);
          if (v && v.indexOf(from) >= 0) e.setAttribute(a, v.split(from).join(to));
        });
        const st = e.getAttribute('style');
        if (st && st.indexOf(from) >= 0) e.setAttribute('style', st.split(from).join(to));
      });
    });
    return root;
  };

  const viewBox = el => {
    const vb = el.getAttribute('viewBox');
    if (vb) return vb.trim().split(/[\s,]+/).map(Number);
    return [0, 0, parseFloat(el.getAttribute('width')) || 1,
            parseFloat(el.getAttribute('height')) || 1];
  };

  /* Map an asset's viewBox onto a millimetre box. A group with a transform,
     not a nested <svg>: design tools read groups back cleanly. */
  const fit = (vb, x, y, w, h) => {
    const sx = w / vb[2], sy = h / vb[3];
    return `translate(${n6(x - vb[0] * sx)},${n6(y - vb[1] * sy)}) scale(${n6(sx)},${n6(sy)})`;
  };

  const innerOf = el => {
    let s = '';
    el.childNodes.forEach(c => { s += c.nodeType === 1 ? c.outerHTML : (c.nodeType === 3 ? c.nodeValue : ''); });
    return s;
  };

  /* ── colour ────────────────────────────────────────────────────────────── */
  const alphaOf = c => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return 1;
    const p = m[1].split(',').map(parseFloat);
    return p.length > 3 ? p[3] : 1;
  };
  const opaque = c => alphaOf(c) > 0.001;

  /* ── gradients ──────────────────────────────────────────────────────────
     Only linear-gradient appears in the pieces, always two stops. CSS angles
     run clockwise from "to top", so 90deg points right. */
  const splitTop = s => {
    const out = []; let d = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') d++;
      if (ch === ')') d--;
      if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map(v => v.trim());
  };

  const gradient = (css, x, y, w, h, defs) => {
    const m = css.match(/^linear-gradient\((.*)\)$/s);
    if (!m) return null;
    const parts = splitTop(m[1]);
    let deg = 180;
    if (/^-?[\d.]+deg$/.test(parts[0])) deg = parseFloat(parts.shift());
    else if (/^to\s/.test(parts[0])) {
      const to = parts.shift();
      deg = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 }[to];
      if (deg === undefined) {
        deg = 180;
        if (/top/.test(to) && /right/.test(to)) deg = 45;
        else if (/bottom/.test(to) && /right/.test(to)) deg = 135;
        else if (/bottom/.test(to) && /left/.test(to)) deg = 225;
        else if (/top/.test(to) && /left/.test(to)) deg = 315;
      }
    }
    const stops = parts.map(p => {
      const c = (p.match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-z]+)/) || [])[1] || '#000';
      const o = p.match(/([\d.]+)%/);
      return { c, o: o ? parseFloat(o[1]) / 100 : null };
    });
    stops.forEach((s, i) => { if (s.o === null) s.o = stops.length === 1 ? 0 : i / (stops.length - 1); });

    const a = deg * Math.PI / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const L = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    const cx = x + w / 2, cy = y + h / 2;
    const id = 'g' + (++uid);
    defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
      `x1="${n(cx - dx * L / 2)}" y1="${n(cy - dy * L / 2)}" ` +
      `x2="${n(cx + dx * L / 2)}" y2="${n(cy + dy * L / 2)}">` +
      stops.map(s => `<stop offset="${n(s.o)}" stop-color="${qt(s.c)}"` +
        (alphaOf(s.c) < 1 ? ` stop-opacity="${n(alphaOf(s.c))}"` : '') + `/>`).join('') +
      `</linearGradient>`);
    return `url(#${id})`;
  };

  /* ── rounded boxes ─────────────────────────────────────────────────────── */
  const oneRadius = (v, w, h) => {
    const p = String(v).split(/\s+/);
    const rx = p[0].endsWith('%') ? parseFloat(p[0]) / 100 * w : parseFloat(p[0]) || 0;
    const b = p[1] || p[0];
    const ry = b.endsWith('%') ? parseFloat(b) / 100 * h : parseFloat(b) || 0;
    return [rx, ry];
  };

  const radiiOf = (cs, w, h, S) => {
    const r = [
      oneRadius(cs.borderTopLeftRadius, w / S, h / S),
      oneRadius(cs.borderTopRightRadius, w / S, h / S),
      oneRadius(cs.borderBottomRightRadius, w / S, h / S),
      oneRadius(cs.borderBottomLeftRadius, w / S, h / S),
    ].map(([a, b]) => [a * S, b * S]);
    /* CSS shrinks radii proportionally when a pair overruns its edge. */
    let f = 1;
    const lim = (a, b, len) => { if (a + b > len) f = Math.min(f, len / (a + b)); };
    lim(r[0][0], r[1][0], w); lim(r[3][0], r[2][0], w);
    lim(r[0][1], r[3][1], h); lim(r[1][1], r[2][1], h);
    return f < 1 ? r.map(([a, b]) => [a * f, b * f]) : r;
  };

  const boxPath = (x, y, w, h, r) => {
    if (!r || r.every(p => p[0] < 0.001 && p[1] < 0.001))
      return `M${n(x)},${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`;
    const [tl, tr, br, bl] = r;
    return `M${n(x + tl[0])},${n(y)}` +
      `H${n(x + w - tr[0])}A${n(tr[0])},${n(tr[1])} 0 0 1 ${n(x + w)},${n(y + tr[1])}` +
      `V${n(y + h - br[1])}A${n(br[0])},${n(br[1])} 0 0 1 ${n(x + w - br[0])},${n(y + h)}` +
      `H${n(x + bl[0])}A${n(bl[0])},${n(bl[1])} 0 0 1 ${n(x)},${n(y + h - bl[1])}` +
      `V${n(y + tl[1])}A${n(tl[0])},${n(tl[1])} 0 0 1 ${n(x + tl[0])},${n(y)}Z`;
  };

  /* ── text ───────────────────────────────────────────────────────────────
     Lines are recovered by walking the text node one character at a time and
     grouping the client rects by their top edge, so wrapping matches exactly
     what the browser did rather than being re-guessed. */
  const metrics = document.createElement('canvas').getContext('2d');

  const linesOf = node => {
    const raw = node.nodeValue;
    const range = document.createRange();
    const out = [];
    let cur = null;
    for (let i = 0; i < raw.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const rects = range.getClientRects();
      if (!rects.length) continue;
      const b = rects[0];
      if (!b.height) continue;
      if (!cur || Math.abs(b.top - cur.top) > 0.6) {
        cur = { top: b.top, bottom: b.bottom, left: b.left, text: '' };
        out.push(cur);
      }
      cur.left = Math.min(cur.left, b.left);
      cur.text += raw[i];
    }
    out.forEach(l => { l.text = l.text.replace(/\s+/g, ' ').trim(); });
    return out.filter(l => l.text);
  };

  const CASE = { uppercase: s => s.toUpperCase(), lowercase: s => s.toLowerCase(),
                 capitalize: s => s.replace(/\b\w/g, c => c.toUpperCase()) };

  const emitText = (node, cs, ctx, out) => {
    const lines = linesOf(node);
    if (!lines.length) return;
    metrics.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const fm = metrics.measureText('Hxg');
    const px = parseFloat(cs.fontSize);
    const asc = fm.fontBoundingBoxAscent || px * 0.8;
    const desc = fm.fontBoundingBoxDescent || px * 0.2;
    const tf = CASE[cs.textTransform] || (s => s);
    const ls = parseFloat(cs.letterSpacing);
    const attrs = `font-family="${qt(cs.fontFamily)}" font-size="${n(px * ctx.S)}"` +
      ` font-weight="${cs.fontWeight}" fill="${qt(cs.color)}"` +
      (ls ? ` letter-spacing="${n(ls * ctx.S)}"` : '') +
      (alphaOf(cs.color) < 1 ? ` fill-opacity="${n(alphaOf(cs.color))}"` : '');
    for (const L of lines) {
      /* half-leading: the baseline sits below the line box top by the extra
         leading split in two, plus the ascent. */
      const lead = (L.bottom - L.top) - (asc + desc);
      const base = L.top + lead / 2 + asc;
      out.push(`<text x="${n(ctx.x(L.left))}" y="${n(ctx.y(base))}" ${attrs}` +
        ` xml:space="preserve">${esc(tf(L.text))}</text>`);
    }
  };

  /* ── the walk ──────────────────────────────────────────────────────────── */
  const SKIP = el => el.classList.contains('artifact__guide') ||
    el.classList.contains('af-bleed-note');

  async function paint(el, ctx, out, defs) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || SKIP(el)) return;
    if (parseFloat(cs.opacity) === 0) return;

    const r = el.getBoundingClientRect();
    const x = ctx.x(r.left), y = ctx.y(r.top);
    const w = r.width * ctx.S, h = r.height * ctx.S;
    const rad = radiiOf(cs, w, h, ctx.S);

    /* No ink crosses the trim. Every element is serialised at its true box:
       the cut lands exactly on the edge of whatever touches it, and nothing
       is cut through. The only thing in the bleed ring is the ground colour,
       painted separately around the art, so the sheet still trims clean
       without any shape continuing past the knife. */
    const fx = x, fy = y, fw = w, fh = h;

    const group = [];
    const mask = (cs.maskImage && cs.maskImage !== 'none') ? cs.maskImage : cs.webkitMaskImage;
    const masked = mask && mask !== 'none';

    /* background, then border.
       A masked box is skipped here: its background IS the ink the mask cuts,
       so painting the box would fill the whole rectangle solid and the mask
       artwork would land on top of a block. */
    const bg = masked ? null : (cs.backgroundImage !== 'none'
      ? gradient(cs.backgroundImage, fx, fy, fw, fh, defs)
      : (opaque(cs.backgroundColor) ? cs.backgroundColor : null));
    if (bg) {
      const a = cs.backgroundImage === 'none' ? alphaOf(cs.backgroundColor) : 1;
      group.push(`<path d="${boxPath(fx, fy, fw, fh, rad)}" fill="${qt(bg)}"` +
        (a < 1 ? ` fill-opacity="${n(a)}"` : '') + `/>`);
    }
    const bw = parseFloat(cs.borderTopWidth) * ctx.S;
    if (bw > 0 && opaque(cs.borderTopColor)) {
      const i = bw / 2;
      const ir = rad.map(([a, b]) => [Math.max(0, a - i), Math.max(0, b - i)]);
      group.push(`<path d="${boxPath(x + i, y + i, w - bw, h - bw, ir)}" fill="none"` +
        ` stroke="${qt(cs.borderTopColor)}" stroke-width="${n(bw)}"/>`);
    }

    /* artwork: an inline <svg>, an <img>, or a CSS-masked box */
    if (el.tagName.toLowerCase() === 'svg') {
      const clone = namespace(el.cloneNode(true), 'a' + (++uid) + '_');
      group.push(`<g transform="${fit(viewBox(clone), x, y, w, h)}">${innerOf(clone)}</g>`);
    } else if (el.tagName === 'IMG') {
      const src = el.getAttribute('src');
      if (/\.svg(\?|$)/i.test(src)) {
        const doc = await asset(src);
        const clone = namespace(doc.cloneNode(true), 'a' + (++uid) + '_');
        group.push(`<g transform="${fit(viewBox(clone), x, y, w, h)}">${innerOf(clone)}</g>`);
      } else {
        group.push(`<image x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"` +
          ` href="${qt(await dataURI(src))}" preserveAspectRatio="none"/>`);
      }
    } else if (masked) {
      /* The mark and the wordmarks are drawn as a mask over currentColor, so
         one file serves black, white and gold. Inline the artwork and paint it
         in the ink the box was carrying, which keeps it as paths rather than
         the bitmap a masked element flattens to on print. */
      const m = mask.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) {
        const ink = opaque(cs.backgroundColor) ? cs.backgroundColor : cs.color;
        const doc = await asset(m[1]);
        const clone = namespace(doc.cloneNode(true), 'a' + (++uid) + '_');
        clone.querySelectorAll('*').forEach(e => {
          const f = e.getAttribute('fill');
          if (f && !/url\(|none/.test(f)) e.setAttribute('fill', ink);
          const st = e.getAttribute('style');
          if (st && /fill:/.test(st) && !/url\(/.test(st))
            e.setAttribute('style', st.replace(/fill:\s*[^;]*/g, 'fill:' + ink));
        });
        /* Anything with no fill of its own inherits from the group. */
        group.push(`<g fill="${qt(ink)}" transform="${fit(viewBox(clone), x, y, w, h)}">` +
          `${innerOf(clone)}</g>`);
      }
    } else {
      /* children: text nodes in place, elements recursively */
      for (const node of el.childNodes) {
        if (node.nodeType === 3) emitText(node, cs, ctx, group);
        else if (node.nodeType === 1) await paint(node, ctx, group, defs);
      }
    }

    if (!group.length) return;

    /* clipping, from overflow or an explicit clip-path */
    let clip = null;
    if (cs.overflow === 'hidden' || cs.overflow === 'clip') clip = boxPath(fx, fy, fw, fh, rad);
    const cp = cs.clipPath;
    if (cp && cp !== 'none') {
      const poly = cp.match(/^polygon\(([^)]*)\)$/);
      if (poly) {
        const pts = poly[1].split(',').map(p => {
          const [a, b] = p.trim().split(/\s+/);
          const px = a.endsWith('%') ? parseFloat(a) / 100 * w : parseFloat(a) * ctx.S;
          const py = b.endsWith('%') ? parseFloat(b) / 100 * h : parseFloat(b) * ctx.S;
          return `${n(x + px)},${n(y + py)}`;
        });
        clip = `M${pts.join('L')}Z`;
      }
    }
    let body = group.join('');
    if (clip) {
      const id = 'c' + (++uid);
      defs.push(`<clipPath id="${id}"><path d="${clip}"/></clipPath>`);
      body = `<g clip-path="url(#${id})">${body}</g>`;
    }
    const op = parseFloat(cs.opacity);
    out.push(op < 1 ? `<g opacity="${n(op)}">${body}</g>` : body);
  }

  const dataURI = async src => {
    const b = await (await fetch(src)).blob();
    return new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
  };

  /* ── the guide layers ──────────────────────────────────────────────────
     Three named layers, one line each, styled exactly as the site's guide
     toggle draws them: Bleeding is the solid teal line, Cutting the dashed
     ink line the knife follows, Safety the dashed red inset. Illustrator
     reads the group ids as layer names, so they land in the Layers panel
     as Bleeding / Cutting / Safety over Artwork. */
  const guides = (W, H, rad) => {
    const t = 0.2;
    const g = [];
    g.push(`<g id="Bleeding" fill="none" data-note="delete before printing">`);
    g.push(`<path d="${boxPath(0, 0, W + 2 * BLEED, H + 2 * BLEED, null)}" ` +
      `stroke="#2C7183" stroke-width="${t}" opacity=".85"/>`);
    g.push(`</g>`);
    g.push(`<g id="Cutting" fill="none" data-note="delete before printing">`);
    g.push(`<path d="${boxPath(BLEED, BLEED, W, H, rad)}" ` +
      `stroke="#111111" stroke-width="${t}" stroke-dasharray="2 1.4" opacity=".85"/>`);
    g.push(`</g>`);
    g.push(`<g id="Safety" fill="none" data-note="delete before printing">`);
    g.push(`<path d="${boxPath(BLEED + SAFE, BLEED + SAFE, W - 2 * SAFE, H - 2 * SAFE, null)}" ` +
      `stroke="#E03C3C" stroke-width="${t}" stroke-dasharray="2 1.4" opacity=".85"/>`);
    g.push(`</g>`);
    return g.join('');
  };

  /* ── the piece ─────────────────────────────────────────────────────────── */
  async function toSVG(artifact) {
    const kind = [...artifact.classList].find(c => TRIM[c]);
    if (!kind) throw new Error('unknown piece');
    const [W, H] = TRIM[kind];
    const box = artifact.getBoundingClientRect();
    const S = W / box.width;                       /* mm per px */
    const ctx = {
      S, W, H, left: box.left, top: box.top,
      x: px => (px - box.left) * S + BLEED,
      y: px => (px - box.top) * S + BLEED,
    };

    const defs = [], out = [];
    await paint(artifact, ctx, out, defs);

    const cs = getComputedStyle(artifact);
    /* The scale matters here: the computed radius is in pixels, and passing
       S = 1 would hand the guide a 53 px corner as though it were 53 mm,
       which on a 100 x 55 mm tag draws an arc straight through the artwork. */
    const rad = radiiOf(cs, W, H, S);
    const CW = W + 2 * BLEED, CH = H + 2 * BLEED;

    /* Art is drawn to the trim; the bleed ring around it is filled with the
       piece's own ground so the sheet can be cut anywhere in the 3 mm. */
    const ground = cs.backgroundColor;
    const bleedFill = opaque(ground)
      ? `<path d="${boxPath(0, 0, CW, CH, null)}" fill="${qt(ground)}"/>` : '';

    const label = `${kind.replace('artifact--', '')} · trim ${W} × ${H} mm · ` +
      `bleed ${BLEED} mm · safety ${SAFE} mm`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${CW}mm" height="${CH}mm" viewBox="0 0 ${CW} ${CH}">
<title>${esc(label)}</title>
<desc>Drawn at true size: one user unit is one millimetre. The artwork sits inside the trim rectangle; the Bleeding, Cutting and Safety layers can be deleted before printing.</desc>
<defs>${defs.join('')}</defs>
<g id="Artwork">${bleedFill}${out.join('')}</g>
${guides(W, H, rad)}
</svg>
`;
  }

  /* ── controls ──────────────────────────────────────────────────────────── */
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

  const nameFor = frame => {
    const piece = frame.closest('.piece');
    const label = frame.querySelector('.piece__label');
    /* Labels carry an editing hint after the separator ("Face · click any line
       to edit it"), which is guidance for the page rather than a name for the
       artwork. Keep the part before it and number the frame, since a piece has
       several variants that all start "Face". */
    const first = label ? label.textContent.split('·')[0] : '';
    const i = [...piece.querySelectorAll('.piece__frame')].indexOf(frame) + 1;
    return 'bdsis-' + slug(piece ? piece.id : 'artifact') +
      '-' + String(i).padStart(2, '0') +
      (first.trim() ? '-' + slug(first) : '') + '.svg';
  };

  const flash = (btn, msg) => {
    const was = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = was; }, 1600);
  };

  const run = async (btn, frame, mode) => {
    const artifact = frame.querySelector('.artifact');
    if (!artifact) return;
    btn.disabled = true;
    try {
      const svg = await toSVG(artifact);
      if (mode === 'copy') {
        let done = false;
        try { await navigator.clipboard.writeText(svg); done = true; } catch (e) { /* below */ }
        if (!done) {
          /* The async clipboard needs a trusted gesture and permission, and
             refuses in enough contexts to need a fallback. The textarea is
             left in place and selected when execCommand also refuses, so that
             "Press ⌘C" is an instruction the user can actually follow —
             removing it first would leave nothing to copy. */
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
        flash(btn, done ? 'Copied' : 'Press ⌘C');
      } else {
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const a = document.createElement('a');
        a.href = url; a.download = nameFor(frame);
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        flash(btn, 'Saved');
      }
    } catch (e) {
      console.error(e);
      flash(btn, 'Failed');
    } finally {
      btn.disabled = false;
    }
  };

  const mount = () => {
    document.querySelectorAll('.piece__frame').forEach(frame => {
      if (!frame.querySelector('.artifact') || frame.querySelector('.svgbar')) return;
      const bar = document.createElement('div');
      bar.className = 'svgbar';
      bar.innerHTML = '<button type="button" class="svgbar__btn" data-svg="save">Save SVG</button>' +
        '<button type="button" class="svgbar__btn" data-svg="copy">Copy SVG</button>';
      frame.appendChild(bar);
      bar.addEventListener('click', e => {
        const b = e.target.closest('[data-svg]');
        if (b) run(b, frame, b.dataset.svg);
      });
    });
  };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount);
  else mount();

  /* Exposed so a piece can be serialised without clicking, which is how the
     export is checked against the live DOM. */
  window.BDSIS = Object.assign(window.BDSIS || {}, { artifactSVG: toSVG });
})();
