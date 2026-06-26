# PolyU IS Branding

Brand system and interactive Lab for the PolyU **Bachelor's Degree Scheme in Interdisciplinary Studies** (JS3000).

## Sites

- **`brand-site/`** — the full multi-page brand guideline (story, voice, logo, colour, typography, graphics, applications, explorations, mockups, themes, and the Lab).
- **`lab-site/`** — a standalone **PolyU IS Lab**: just the interactive Cell System exhibits, locked to the Daylight Campus colour theme.

Both are static sites (vanilla HTML/CSS/JS; the Toy Bin exhibit loads matter.js from a CDN).

### Run locally

```sh
python3 -m http.server 8765 --directory brand-site   # full guideline
python3 -m http.server 8766 --directory lab-site      # standalone Lab
```

Then open <http://localhost:8765> or <http://localhost:8766>.

## The Lab

Eight exhibits built on the Cell System — motion studies, production tools, and campaign interactives:
Assembly, Display, Kaleidoscope, Composer, Your Mark, Open Seat, Toy Bin, and the Cell Code
(a scannable mark with an in-browser camera decoder). All processing is local; nothing is transmitted.

## `knowledge-graph/`

Markdown notes distilled from the source materials (strategy, programme, identity).
