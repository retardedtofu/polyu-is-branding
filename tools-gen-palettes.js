/* Generates palettes.css + the PAL object for lab.js.
   Palette (hue family) and mode (day/night) are independent axes. Day sets are
   the existing brand directions; night sets are derived by lifting each hue to a
   legible band on a dark ground, except Terra Night and Mono Gold, authored by hand. */
const fs = require('fs');

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hsl2rgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return t.map(v => (v + m) * 255);
}
/* lift a day hue onto a dark ground: raise lightness into a legible band,
   tame very high saturation so it doesn't glare */
const lift = h => {
  const [hu, s, l] = rgb2hsl(hex2rgb(h));
  return rgb2hex(hsl2rgb([hu, Math.min(s, 0.70), Math.max(0.52, Math.min(0.76, 0.56 + (l - 0.45) * 0.40))]));
};
const liftFams = fams => fams.map(([a, b]) => [lift(a), lift(b)]);

const relLum = h => { const [r, g, b] = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => rgb2hex(hex2rgb(a).map((v, i) => v + (hex2rgb(b)[i] - v) * t));
/* walk a colour's lightness away from the ground until it clears the target ratio,
   so palette-driven links and muted text stay legible on every ground */
function readable(fg, bg, target = 4.5) {
  const dark = relLum(bg) > 0.4;      // light ground -> darken the colour
  let [h, s, l] = rgb2hsl(hex2rgb(fg));
  for (let i = 0; i < 60 && contrast(fg, bg) < target; i++) {
    l = dark ? Math.max(0, l - 0.015) : Math.min(1, l + 0.015);
    fg = rgb2hex(hsl2rgb([h, s, l]));
  }
  return fg;
}

const P = {
  ink: {
    label: '01 Ink & Paper',
    day: { fams: [['#634093','#A4346B'],['#ED174B','#F0584A'],['#F7941E','#ED174B'],['#8CC75F','#2DB44A'],['#2E9FD6','#0A65A2']],
           dark:'#11151C', paper:'#FBFAF7', cellline:'#D8D4CA', grid:'#F0EDE6' },
    night: { dark:'#080A0E', paper:'#15181E', cellline:'#333941', grid:'#1D2128' },
  },
  scholar: {
    label: '02 Midnight Scholar',
    day: { fams: [['#4A4178','#8E3A5A'],['#BD2956','#A02447'],['#D9A53C','#BD2956'],['#7BA796','#3F7878'],['#2F6BA4','#143A6B']],
           dark:'#1E1B36', paper:'#F6F1E6', cellline:'#D9D0BA', grid:'#EFE9DA' },
    night: { dark:'#0D0B18', paper:'#181530', cellline:'#332E52', grid:'#201C3D' },
  },
  daylight: {
    label: '03 Daylight Campus',
    day: { fams: [['#894E73','#D24B43'],['#E14729','#C73A20'],['#F4A640','#E14729'],['#B0BC72','#7E9A4D'],['#54ABBB','#26707F']],
           dark:'#2E2722', paper:'#F8F2E7', cellline:'#DCD0B6', grid:'#F0E8D6' },
    night: { dark:'#12100D', paper:'#1E1A15', cellline:'#3D362C', grid:'#26221B' },
  },
  precision: {
    label: '04 Precision Spectrum',
    day: { fams: [['#3E4AA6','#2C6FC0'],['#E1227C','#B62E86'],['#34C6C3','#1565A8'],['#5FBA8E','#2F8E62'],['#2E9FD6','#04568C']],
           dark:'#0B1521', paper:'#F4F9FC', cellline:'#C9DAE6', grid:'#E4EEF5' },
    night: { dark:'#060D15', paper:'#101A24', cellline:'#2A3B4A', grid:'#16222E' },
  },
  terra: {
    label: '05 Terra',
    day: { fams: [['#8C2B55','#AB0334'],['#AB0334','#8C022B'],['#FF8C00','#F26649'],['#C2C684','#A8B468'],['#54ABBB','#3A8FA3']],
           dark:'#261F1A', paper:'#F9F5EC', cellline:'#DDD4BF', grid:'#F1EADA' },
    /* authored, not derived */
    night: { fams: [['#C75986','#F0426B'],['#F0426B','#C22550'],['#FFA333','#FF7A50'],['#D8DD9C','#BCC77B'],['#6FC7D7','#4AA6BA']],
             dark:'#0E0C0A', paper:'#1C1815', cellline:'#3B342C', grid:'#252019' },
  },
  'mono-gold': {
    label: '06 Mono Gold',
    /* One gold, everything else neutral. Three golds of differing depth plus two
       neutrals keep the five family chips distinguishable. Accents are declared
       separately from the cell ramp: a quiet dark-neutral cell is fine as a
       graphic but unreadable as accent text, so accents stay on the legible side
       of the ground in each mode. */
    day: { fams: [['#3A352C','#22201A'], ['#C9A227','#9A7B14'], ['#E0C878','#C9A227'], ['#8A8274','#635C50'], ['#9A7B14','#6E560E']],
           accents: ['#635C50', '#9A7B14', '#8A6D1F', '#4A443A', '#8A6D1F'],
           dark:'#1A1712', paper:'#F7F4EC', cellline:'#DED7C5', grid:'#EFEADC',
           base: { '--paper':'#F7F4EC', '--paper-deep':'#EDE7D8', '--surface':'#FFFFFF',
                   '--ink':'#1A1712', '--ink-soft':'#3B362C', '--grey':'#6B6354', '--line':'#E2DBCA',
                   '--link':'#8A6D1F', '--dark-panel':'#1A1712', '--dark-panel-soft':'#332E25' } },
    night: { fams: [['#4A4438','#312C24'], ['#F0D08A','#C9A227'], ['#F7E3B5','#E0C878'], ['#8A8274','#5C554A'], ['#C9A227','#96741A']],
             accents: ['#C9BFA6', '#F0D08A', '#E0C878', '#A89E88', '#F0D08A'],
             dark:'#0A0908', paper:'#17140F', cellline:'#3A3428', grid:'#211D16',
             base: { '--paper':'#0F0D0A', '--paper-deep':'#1C1813', '--surface':'#17140F',
                     '--ink':'#F5EFE0', '--ink-soft':'#D5CCB8', '--grey':'#A89E88', '--line':'#332C21',
                     '--link':'#E0C878', '--on-ink':'#0F0D0A', '--dark-panel':'#221D16', '--dark-panel-soft':'#2E2820',
                     '--light-panel':'#F5EFE0' } },
  },
};

/* fill in derived night fams where not authored */
for (const k of Object.keys(P)) if (!P[k].night.fams) P[k].night.fams = liftFams(P[k].day.fams);

/* --is-* accent spectrum maps off the family ramp, so accents follow the palette */
const SLOTS = ['--is-purple', '--is-crimson', '--is-orange', '--is-green', '--is-blue'];

let css = `/* ===== Palettes — GENERATED by scratchpad/gen_palettes.js, do not hand-edit =====
   Palette and mode are independent: html[data-palette][data-mode].
   Each block sets the cell families (--f*), the accent spectrum (--is-*) and the
   Lab surface tokens, so cell graphics and accents work on every page. */\n`;

for (const [key, p] of Object.entries(P)) {
  for (const mode of ['day', 'night']) {
    const v = p[mode];
    const sel = `html[data-palette="${key}"][data-mode="${mode}"]`;
    const lines = [];
    v.fams.forEach(([a, b], i) => lines.push(`  --f${i + 1}a:${a}; --f${i + 1}b:${b};`));
    lines.push(`  --lab-dark:${v.dark}; --lab-paper:${v.paper}; --lab-cellline:${v.cellline}; --lab-grid:${v.grid};`);
    let acc = v.accents || v.fams.map(f => f[0]);
    /* Night accents must clear the darkest surface they land on (the soft dark
       panel), or a derived hue can end up unreadable there. Day accents are left
       exactly as authored — they are the brand directions themselves. */
    if (mode === 'night') {
      const panel = mix(v.paper, '#FFFFFF', 0.11);
      acc = acc.map(c => readable(c, panel, 4.5));
    }
    SLOTS.forEach((s, i) => lines.push(`  ${s}:${acc[i]};`));
    lines.push(`  --is-green-light:${acc[3]}; --is-blue-deep:${acc[4]};`);
    /* gradients follow the palette so .asset.on-grad and the ratio bar recolour */
    const gnames = ['--grad-purple', '--grad-crimson', '--grad-orange', '--grad-green', '--grad-blue'];
    v.fams.forEach(([a, b], i) => lines.push(`  ${gnames[i]}:linear-gradient(135deg, ${a}, ${b});`));

    /* full foundation, so the palette recolours the whole site, not just accents */
    const base = {};
    if (mode === 'day') {
      const surface = '#FFFFFF';
      Object.assign(base, {
        '--paper': v.paper, '--paper-deep': v.grid, '--surface': surface,
        '--ink': v.dark, '--ink-soft': mix(v.dark, v.paper, 0.22),
        '--grey': readable(mix(v.dark, v.paper, 0.55), surface),
        '--line': v.cellline, '--on-ink': '#FFFFFF',
        '--dark-panel': v.dark, '--dark-panel-soft': mix(v.dark, '#FFFFFF', 0.12),
        '--light-panel': surface, '--on-dark-panel': mix(v.paper, '#FFFFFF', 0.4),
        '--on-light-panel': v.dark,
        '--link': readable(v.fams[4][1], surface),
      });
    } else {
      const surface = v.paper, ground = v.dark;
      const lightInk = mix('#FFFFFF', v.cellline, 0.16);
      Object.assign(base, {
        '--paper': ground, '--paper-deep': v.grid, '--surface': surface,
        '--ink': lightInk, '--ink-soft': mix(lightInk, surface, 0.28),
        '--grey': readable(mix(lightInk, surface, 0.55), surface),
        '--line': v.cellline, '--on-ink': ground,
        '--dark-panel': mix(surface, '#FFFFFF', 0.05), '--dark-panel-soft': mix(surface, '#FFFFFF', 0.11),
        '--light-panel': lightInk, '--on-dark-panel': lightInk, '--on-light-panel': ground,
        '--link': readable(acc[4], surface),
      });
    }
    if (v.base) Object.assign(base, v.base);   // hand-authored overrides win
    for (const [k2, val] of Object.entries(base)) lines.push(`  ${k2}:${val};`);
    css += `${sel} {\n${lines.join('\n')}\n}\n`;
  }
}

const pal = {};
for (const [key, p] of Object.entries(P)) for (const mode of ['day', 'night']) {
  const v = p[mode];
  pal[`${key}-${mode}`] = { dark: v.dark, paper: v.paper, cellline: v.cellline,
    ghostDark: 'rgba(255,255,255,0.16)', ink: mode === 'night' ? '#F2EDE2' : v.dark, fams: v.fams };
}
const js = 'const PAL = ' + JSON.stringify(pal, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:') + ';\n';
const labels = 'const PALETTES = ' + JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.label]))) + ';\n';

const out = process.argv[2];
fs.writeFileSync(out + '/palettes.css', css);
fs.writeFileSync(out + '/_pal.js', labels + js);
console.log('palettes:', Object.keys(P).join(', '));
console.log('css blocks:', (css.match(/^html\[/gm) || []).length);
