# Review: "Qwen designs the world's look.html"

Reviewed against the live Phaser world (`/world`), with screenshots of the
prototype rendered three ways (game view, whole-map view, tile contact sheet).
Two real bugs had to be fixed just to see the intended result: character
sprites are captured from `ART` before `generateArt()` runs (so the player and
NPCs are never drawn), and `PAL.green/yellow/gray/skyLight/gold/pink/violet/
fuchsia` are referenced but never defined (status dots never render).

## Verdict

- **Art execution: ~3/10 (programmer art).** Terrain tiles are flat colour
  fills with scattered 2px speckles and a black grid outline; trees are single
  circles; buildings are solid fills with anti-aliased canvas-path roofs
  (which breaks the pixel aesthetic); characters are head-block-legs with no
  faces, arms, or walk-pose difference.
- **Village layout design: ~6.5/10 (genuinely good).** Central brick plaza as
  the heart, dirt-path spokes from every door to the plaza, pond landmark,
  portal mid-map, six buildings in two organic rows.

## Why we are not adopting the art

Our current world already executes this exact layout language with real asset
art: LPC terrain with 99 corner-blended transition tiles, six tree variants
(including autumn and pale), Kenney 2× buildings with roof variants and
nameplates, pond with animated shimmer, fenced gardens, lamps, benches, a well
on the plaza edge, and animated Dawnlike characters. Replacing any of that
with the prototype's flat procedural art would be a visual downgrade.

## If Qwen retries the world look, the target is

1. No flat fills: every 32px tile needs 3–4 shades, dithering at edges, and
   no black grid outline between tiles.
2. No anti-aliased arcs/paths — pixel outlines only, drawn as rectangles.
3. Trees: layered foliage clumps (3+ blobs with highlight/shadow sides), not
   one circle; trunk base must visually connect to the ground.
4. Characters: 16×24 minimum with face pixels, arms, and a visible difference
   between idle and walk frames in all 4 directions.
5. Roofs: stepped pixel shingles with an eave row that overhangs the wall.
6. Water: shoreline transition tiles (grass-to-water corners), not a flat
   blue rect.

The prototype is archived next to this file unchanged, with the two bug fixes
applied only in a temporary review copy (never committed).
