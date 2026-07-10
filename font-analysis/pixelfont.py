#!/usr/bin/env python3
"""
Geist Pixel Circle — analysis & repurposing toolkit.

The font is a pixel font built on a fixed grid:
    PITCH = 38 font units  (one pixel cell)
    DOT   = 38 unit circle (fills the cell; adjacent dots are tangent)
    Pixel (col,row) center = (19 + 38*col, 19 + 38*row), baseline at y=0.

This module turns any glyph into a clean (col,row) pixel matrix so you can
replace each "pixel" (currently a circle) with any shape you want, while
reusing the font's own kerning to lay out text.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from collections import defaultdict

FONT = "GeistPixel-Circle.otf"
PITCH = 38.0          # grid pitch in font units == 1 pixel
OFFSET = 19.0         # center of pixel (0,0); == PITCH/2, baseline-aligned
UPM = 1000            # units per em


def load():
    return TTFont(FONT)


def glyph_pixels(font, glyphname):
    """Return a set of integer (col, row) cells occupied by the glyph.
    row 0 sits on the baseline; positive = up, negative = descender."""
    gs = font.getGlyphSet()
    if glyphname not in gs:
        return set()
    pen = RecordingPen()
    gs[glyphname].draw(pen)
    cells = set()
    cur = []
    for cmd, pts in pen.value:
        if cmd == "moveTo":
            cur = [pts[0]]
        elif cmd in ("lineTo", "qCurveTo", "curveTo"):
            cur += [p for p in pts if p]
        elif cmd == "closePath":         # one contour == one circle == one pixel
            xs = [p[0] for p in cur]
            ys = [p[1] for p in cur]
            cx = (min(xs) + max(xs)) / 2
            cy = (min(ys) + max(ys)) / 2
            cells.add((round((cx - OFFSET) / PITCH), round((cy - OFFSET) / PITCH)))
            cur = []
    return cells


def ascii_glyph(font, glyphname):
    px = glyph_pixels(font, glyphname)
    if not px:
        return "(no pixels)"
    cols = [c for c, _ in px]
    rows = [r for _, r in px]
    out = []
    for r in range(max(rows), min(rows) - 1, -1):
        line = "".join("#" if (c, r) in px else "." for c in range(min(cols), max(cols) + 1))
        out.append(line)
    return "\n".join(out)


def advance_px(font, glyphname):
    """Glyph advance width in pixels (font advance / PITCH)."""
    return font["hmtx"][glyphname][0] / PITCH


def kerning(font):
    """Return kerning as {(left_glyph, right_glyph): pixels}. Negative = pull closer."""
    gpos = font["GPOS"].table
    pairs = {}
    for lk in gpos.LookupList.Lookup:
        if lk.LookupType != 2:           # 2 == pair adjustment (kern)
            continue
        for st in lk.SubTable:
            if st.Format == 1:           # explicit pairs
                for first, pset in zip(st.Coverage.glyphs, st.PairSet):
                    for pvr in pset.PairValueRecord:
                        v = pvr.Value1
                        xa = getattr(v, "XAdvance", 0) if v else 0
                        if xa:
                            pairs[(first, pvr.SecondGlyph)] = xa / PITCH
            elif st.Format == 2:         # class-based
                c1 = defaultdict(list)
                c2 = defaultdict(list)
                for g, c in st.ClassDef1.classDefs.items():
                    c1[c].append(g)
                for g, c in st.ClassDef2.classDefs.items():
                    c2[c].append(g)
                # class 0 = "everything not otherwise classified"; we expand only
                # the explicitly-listed members for class 0 on the right side.
                for i, cr in enumerate(st.Class1Record):
                    for j, c2r in enumerate(cr.Class2Record):
                        v = c2r.Value1
                        xa = getattr(v, "XAdvance", 0) if v else 0
                        if not xa:
                            continue
                        for lg in c1.get(i, []):
                            for rg in c2.get(j, []):
                                pairs[(lg, rg)] = xa / PITCH
    return pairs


if __name__ == "__main__":
    f = load()
    print("=== GRID ===")
    print(f"pitch={PITCH}u  dot=Ø{PITCH}u  upm={UPM}  ({UPM/PITCH:.2f}px/em)")
    print("x-height=14px  cap-height=19px  descender=-4px  baseline=row 0\n")
    print("=== SAMPLE 'A' ===")
    print(ascii_glyph(f, "A"))
    print("\n=== KERNING PAIRS (in pixels) ===")
    for (a, b), v in sorted(kerning(f).items()):
        print(f"  {a:>6} | {b:<6}  {v:+.1f}px")
