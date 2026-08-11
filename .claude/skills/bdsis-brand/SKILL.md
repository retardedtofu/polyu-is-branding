---
name: bdsis-brand
description: The BDSIS / PolyU Interdisciplinary Studies brand rules — dos, don'ts, tokens and print law. Load BEFORE designing, reviewing or editing anything carrying the BDSIS brand - web pages, print artifacts, decks, documents, letterheads, cards, banners - or before touching bdsis-web/. Triggers - "BDSIS", "brand check", "on brand", "brand review", any design work in this repo.
---

# BDSIS Brand Rules

The brand system for the Bachelor's Degree Scheme in Interdisciplinary Studies
(JUPAS JS3000), College of Undergraduate Studies, PolyU. These are the settled
rules. Do not re-derive them, do not "improve" them, and when a change is
genuinely needed, change `bdsis-web/web.css` AND the guidelines prose that
documents it in the same pass — the stylesheet is the contract.

## Authoritative sources, in order

1. `bdsis-web/web.css` — every token, theme and component. The contract.
2. `bdsis-web/guidelines.html` — the documented system (15 sections).
3. `bdsis-web/artifacts.html` — print pieces at true scale (1em == 1mm).
4. `bdsis-web/cellhash.js` — the signature-field generator. Parity-locked.
5. `PolyU Brand_Communication_Guidelines.pdf` — University law (pdftotext).

## Logo — DO

- Use the real artwork in `bdsis-web/assets/` only: `mark-colour.svg`,
  `mark-mono.svg`, wordmarks, `polyu-logo-colour.svg` / `polyu-logo-white.svg`.
- Endorsed lockup ("PolyU Interdisciplinary Studies") is the default face.
  Standalone ("Interdisciplinary Studies") ONLY where PolyU context is already
  established or the University logo sits beside it.
- Pairing rule: beside the University logo, the mark is 90% of the logo's full
  box height, gap = mark height. University logo always leads.
- Minimums: standalone 10 mm, endorsed 12 mm in print. Card formats only
  (90×54, ID-1) may drop the mark to 6.5 mm. Nothing else.
- Mono: `mark-mono.svg` is its own artwork with gaps between quadrants.

## Logo — DON'T

- Never mask or filter one colourway to fake another (no invert, no silhouette
  of the colour mark as "mono", no filtering white to black or vice versa).
- Never recolour the logo to the Terra families — the official pack stays in
  its original spectrum until a revised pack is issued.
- Never use the rejected OneDrive `BDSIS Logo Pack/` artwork.
- Never show the standalone lockup alone on a surface.

## Colour — DO

- Four families, always as GRADIENTS with the documented directions:
  Red `#A02337→#861C2C` 90°, Tangerine `#F2A03B→#E14729` 45°,
  Olive `#C2C684→#A8B468` 135°, Ocean `#54ABBB→#3A8FA3` 180°.
- ONE red: PolyU Red `#A02337` (PMS 194 C). There is no separate BDSIS red.
- Text on a family field uses the `--on-*` tokens; text IN a family colour uses
  the `-ink` variants only: `#B8390F` tangerine, `#5F6733` olive, `#2C7183`
  ocean. Flat family values fail contrast as text and as QR ink.
- Ground is warm cream `#F8F2E7` (the paper, never a flood tint), ink `#14110E`.
- Metadata text uses `--meta`, never `--polyu-grey` (fails on dark themes).

## Colour — DON'T

- Never fill a shape with a flat family colour (gradient always), never
  combine two families in one shape, never outline a kit shape on brand
  surfaces (the cards' Outline option is the one sanctioned exception).
- PolyU Red is theme-blind and lives only in the banner block; interactive
  states use `--is-crimson-ink`.
- Don't hand-compute CMYK from hex. Use the documented builds in §07 or send
  hex and let the printer's ICC profile convert.

## Shape kit

- Four primitives only: quarter circle (rotations), square, triangle, circle.
  No semicircles, no new shapes.
- One-corner rule: containers are square or carry ONE quarter-round on the
  bottom-right. Never two, never four.
- Mono/one-plate renditions separate shapes with a uniform channel of stock
  (0.9 mm on the letterhead wedge) — geometric insets, never a centred stroke,
  trim-side edges stay flush. Nothing fuses into a block.
- Composition restraint: one shape per surface, two at most on opposite
  corners. Three-plus shapes with text bars reads "super busy" — rejected.

## Type

- Helvetica Neue: display/h1 Roman 400, h2–h4 Medium 500. Thin 200 is
  print-only display; Light 300 only on statistic numerals.
- Chinese: MHei/PingFang stack listed AFTER the Latin face; CJK sizes floor
  higher (14px min labels); CJK tracking goes DOWN, not up; ID-card Chinese
  name sets LARGER than its Latin line.
- House style: NO em dashes in prose anywhere. Recast with full stops, commas,
  colons or `·`. Watch for AI-tells (aphoristic closers, "It is not X. It is Y.").
- Font binaries (Helvetica Neue OTFs) are licensed: NEVER committed, never in
  the deploy artifact. The workflow guard enforces this — do not weaken it.

## Print law

- NO INK CROSSES THE TRIM. Every shape and lattice ends exactly on the cut;
  field lattices fit whole cells to the trim (bc 15×6 @6 mm, tag 25×9 @4 mm,
  id 16×4 @5.35 mm, board panels 17×12 @50 mm). The bleed ring carries only
  the ground colour.
- Guide language, identical on web and in files: Bleeding = solid teal
  `#2C7183` 3 mm outside the trim; Cutting = dashed ink `#111` on the trim;
  Safety = dashed red `#E03C3C` 8 mm inside.
- Exported SVG/AI carry four named layers: Artwork, Bleeding, Cutting, Safety.
  The .ai files are PDF with real OCG layers plus TrimBox/BleedBox.
- The download packs are GENERATED — never hand-edit files in
  `bdsis-web/downloads/print/`. Regenerate from the live page (capture must be
  sequential: click one Save, await its blob, assert each file against its
  section's trim size).
- Word letterheads: exact A4, artwork page-anchored `behindDoc` (never inline
  in the header — Word's print path clips it). `downloads/word/colour/` and
  `downloads/word/mono/`.

## Signature fields (the hash)

- `cyrb128` / `sfc32` in `cellhash.js` are parity-locked with the Lab. Never
  edit them. Three RNG draws per cell in order roll/family/rotation, always
  taken, so overrides and pixel mode never shift later cells.
- Shares: quarter 50% · split 16% · circle 12% · square 10% · empty 12%.
- Inline SVG only, never canvas (exports must stay vector).
- Pixel type: text starts at cell (1,1) so the knife never touches it; text
  cells keep only full-coverage shapes; ground keeps the documented shares.
- All input is processed locally in the browser — nothing transmitted or
  stored. Keep it that way; it is why student numbers are safe to type.

## Themes and web

- Three themes: `light` / `dark` / `dark-mono-gold`. Dark is FULL COLOUR
  (relit families from §14); only gold is monotone.
- `.section--ink` stays dark in every theme → literal `#FFFFFF` text.
  `.section--red` flips light in dark themes → `var(--on-crimson)`, never
  literal white. Getting these backwards is the most common bug.
- Warning colour never themes (`--warn-line #E03C3C`).
- Editing English prose orphans its Chinese: re-key `zh.js` (keyed on exact
  English innerHTML) in the same pass.

## Verifying (run, don't eyeball)

- Contrast: audit gradient-aware (test against the worst stop). Two failures
  are INTENTIONAL specimens — the §13 "Don't" heading and the ID card
  PORTRAIT placeholder. Do not fix them.
- Trim: no inked element may cross the trim rect in any export (allow touch,
  flag cross; map nested-svg coordinates through client rects).
- Banner/board type is sized for distance — exclude `.artifact--panel` from
  naive minimum-size checks.
- After editing guideline prose, re-run the wordcount-per-section and
  zh-coverage checks.
