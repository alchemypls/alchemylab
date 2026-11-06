# Vector page reference

Types and ops: `lib/design/vector.ts`. Renderer: `workbench/ui/VectorArtboard.tsx`. Coordinates are page
px (1920 × 1080 unless the page sets `size`). Later elements draw on top. A vector page is a normal page with
`"blocks": []` and `"elements": [...]`, plus optional `background`, `size: {width, height}` (for a big map) and
`grid: {cell, flat}` (default 32px, isometric).

## Elements

Every element: `id`, `type`, optional `link` (page or topic id; click opens it) and `opacity` (0–1).

| type | fields |
|---|---|
| `rect` | `x y w h`, `fill`, `stroke`, `strokeWidth`, `dash`, `radius` |
| `ellipse` | `x y w h`, `fill`, `stroke`, `strokeWidth`, `dash`, `n` (superellipse exponent: 1 diamond, 2 ellipse = default, 4 squircle, 10 near-box, below 1 a pinched star) |
| `capsule` | `x y w h`, `fill`, `stroke`, `strokeWidth`, `dash`, `taper` (0–1, default 1) — two circles joined by tangents along `w`: the left end is `h` across, the right `taper × h` (a flipper is about 0.6) |
| `poly` | `x y w h`, `pts: [[fx, fy], …]` (corners as 0–1 fractions of the box), `open` (a path, unfilled), `fill`, `stroke`, `strokeWidth`, `dash` — any outline; resizes, rotates and lies in planes like a rect |
| `line` | `from`, `to` (each `{x, y}` or `{el: id}`), `stroke`, `strokeWidth`, `dash`, `arrow: none\|end\|both` (default end), `bend` (px) |
| `text` | `x y w h`, `text`, `size`, `weight`, `font: sans\|serif\|mono`, `color`, `align`, `valign`, `caps`, `bind: {topic, field: title\|summary}`, `bg` (color), `bgShape: block\|round\|pill\|ellipse` |
| `image` | `x y w h`, `src` (file in assets/), `fit: contain\|cover` |
| `status` | `x y`, `size`, `topic` — live status dot |
| `stroke` | `points: [x, y][]`, `pressures?`, `color`, `width`, `brush: ink\|marker\|highlighter` — freehand |
| `asset` | `x y w h`, `asset` (id in `vault/assets/`), `tint` (color, this placement only) — a drawing from the global vault |
| `zone` | `x y` (first corner), `cols rows`, `cell`, `flat`, `fill`, `stroke`, `strokeWidth`, `dash`, `noLines` — floor of tiles; always draws under everything else |

- `dash` on shapes, lines and floors: `true` is dashed, `"dot"` is dotted.
- **Floors fit together on the page grid.** Isometric corners: `x = (a - b) * cell`, `y = (a + b) * cell / 2`, for whole
  `a, b`; flat: `x = a * cell`, `y = b * cell`. The tile at (a, b) spans a..a+1 and b..b+1. Use even `cell` values.
- **Pieces stand on tiles.** An `asset`, `image`, `rect` or `ellipse` stands on a zone when its bottom center (middle on a flat
  zone) is over it, and then moves with the zone. Keep pieces and labels off a large opaque `rect`: it would hide floors.
- **Paint on a floor with `on: <zone id>`.** Lane lines, inserts, guide walls, arrows across the floor: when the page flips
  between flat and isometric they follow it tile for tile (flat boxes lie in the floor plane when isometric; line and stroke
  points move). Without `on`, shapes over a floor are page layout and stay put. Callouts and labels beside a floor: leave it off.
- **Attach arrows** with `{el: id}`: they stay connected when shapes move, and stop at the shape's edge.
- **Bind, don't copy.** Use `bind` and `status` for anything that lives in bible.json, so the doc can't drift from it.
  A bound text's `text` is ignored: write `""`.
- **Text never grows.** Size the box for its content; text past the box is clipped and reported as overflow.

## Vault assets

Global drawings live in `vault/assets/<id>.json`: a vector page plus `kind: shape|icon|block`, with `blocks: []`.
A `block` is a game piece: optional `footprint: {cols, rows}`, drawn on its isometric sheet standing on that footprint;
placed, it takes its size from its file (only move, `tint`, `layers` and `turn` it on a page). `turn` (degrees about where it
stands): on a flat floor any angle; on an isometric floor it's redrawn at the nearest quarter turn (footprint cols/rows swap).
`mirror: true` mirrors any placed asset; a block flips end to end along its columns and keeps its footprint (one flipper file gives left and right).
In a block, a flat shape that stands up (a ball, a post) gets `upright: true` (and `base`: px its bottom sits above the
floor): seen from above it keeps its shape instead of slanting. On a flat floor it shows from
above: floor-plane shapes exactly, wall-plane shapes as their base edge (a line), wall text not at all. They
can't contain `asset`, `image` or `status` elements, `bind` or `link`. Reference one with an `asset` element instead
of redrawing it: editing the file changes every page using it. A shape places trimmed to its drawing; an icon places
its whole sheet. `npm run -s design:check` validates them.

Palettes live in `vault/palettes/<id>.json`: `{ title, colors: [{ name, value: "#rrggbb" }] }`. When a bible has
a palette, color its pages from it. Colors are copied into elements, not linked, so changing a palette later
doesn't recolor pages.

## Planes

`plane: floor|roof|left|right` on `rect`, `ellipse`, `capsule`, `text` and `image` lays the shape in an isometric plane. Keep
`x y w h` as its own flat box: (x, y) is where its top-left corner lands, and the box maps from there. On the floor,
`w` runs down-right along tile columns and `h` down-left along rows, so `w = cols × cell`, `h = rows × cell` covers
those tiles exactly (start at a tile corner). `left` and `right` are a block's two visible faces: `w` runs along the
floor edge (down-right / up-right), `h` straight down. `roof` is the floor plane raised by `lift` px (default 64): keep x, y
as its corner on the floor under it, and match `lift` to the walls' `h` so it caps them. `slope` (-0.9–0.9, px of rise per px) tips a roof up along `slopeAlong: h|w` (default h), away from
(x, y); two roofs sloping up to a shared ridge make a gable. A shape in a plane doesn't rotate.

## Rotation

`rotate` (degrees clockwise, around the box's center) works on `rect`, `ellipse`, `capsule`, `text`, `image` and `asset`.
Keep `x y w h` as the unturned box. Attached arrows meet the turned edge, and the overlap and off-artboard
checks use the turned outline.

## Layers

A page or vault asset can have `layers: [{ id, name, hidden?, locked? }]`, bottom to top, and each element names
its layer with `layer`. No `layers` means one layer; an element without `layer` sits on the bottom one. Floors
draw first within their layer, not across layers.

- **Hidden layers are the user's.** You can read them, but the user can't see them on the page and the fit report
  skips them. `design:check` lists them as `hidden`. Don't put anything the user should see on a hidden layer,
  don't unhide or delete one without asking, and don't refer to what's on it as if it were visible.
- **Locked** layers are drawn but the user's tools can't touch them. Leave their contents alone unless asked.
- When adding to a page with layers, give new elements the `layer` they belong on.
- **Asset versions:** an asset's hidden layers start hidden where it's placed. A placement can pick its own with
  `"layers": ["<layer id>", …]` on the `asset` element, for example an icon with Outline and Filled layers.

## Eyes

You can't see the page. After each write run `npm run -s design:check -- <bible>`: it reports text past its box,
elements off the artboard and overlapping text boxes. It can't judge looks: `npm run -s page:render -- <bible> <page> [--crop x,y,w,h]` draws the page to
.render/<bible>-<page>.png (read it), and ask the user for a screenshot after a big change.

## Layout habits

Margins 56px. Pick 2–4 columns and shared rows before placing anything, and snap to multiples of 8. Compute
positions in a small script for repeated rows instead of hand-writing each one. Change a few elements with
targeted edits, not a full rewrite. A dense page is about 130 elements, or 10k tokens to write.
