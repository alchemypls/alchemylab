# Page + block reference

Types are authoritative in `lib/design/types.ts`. The renderer is `workbench/ui/DesignArtboard.tsx`.

## Page

```json
{
  "title": "Core Loop",
  "kicker": "Play",                 // optional, defaults to the topic's group
  "topic": "core-loop",             // omit on index
  "updated": "2026-10-29",
  "knowledge": [
    { "id": "k-loop-length", "kind": "decision", "text": "A loop takes 90 seconds.", "why": "Fits a bus-stop session." }
  ],
  "agent": { "brief": "…", "rules": ["…"], "open": ["…"] },
  "blocks": [ … ]
}
```

Knowledge kinds: `decision` · `hypothesis` · `question` · `evidence`.

## Blocks

Every block: `id`, `type`, optional `title` (small caps heading), `span` (1–12 columns, default 12),
`rows` (span grid rows, for a tall side column).

| type | fields | use for |
|---|---|---|
| `text` | `body` (blank line = paragraph) | short prose |
| `bullets` | `items: string[]` | lists |
| `callout` | `text`, `tone: pillar\|note\|risk` | the pitch, one key statement |
| `cards` | `items: {title, body}[]` (≤4 per row look best) | pillars, options, characters |
| `flow` | `steps: string[]`, `loop?: true` | core loop, pipelines, beats |
| `stats` | `items: {label, value}[]` | numbers: session length, team size |
| `knowledge` | `kinds?: Kind[]`, `ids?: string[]` | shows page.knowledge entries with kind badges |
| `topics` | `groups?: string[]`, `compact?: true` (titles only, ~42px per row, summary on hover) | the bible skeleton with status dots (index page) |
| `links` | `items: {page, label, note?}[]` | links to other pages (click opens them) |
| `image` | `src` (file in assets/), `caption?`, `fit?`, `height?` (px, default 320) | references, sketches |

## Space budget

The body area is about **1776 × 800 px**. Rough heights at full width: callout 110, cards 170,
flow 70 (+40 with loop), stats 90, text 34 per line (~110 chars per full-width line), knowledge 45
per entry, topics ~60 per topic row (tallest group) + 40. Gaps between rows are 32.
Usually 3–4 rows of blocks fit. Side by side is cheaper than stacked: put spans like 7+5 or 4+4+4 on one row.

## Index layout (genesis)

```json
[
  { "id": "pitch",   "type": "callout", "text": "<pitch>", "tone": "pillar" },
  { "id": "pillars", "type": "cards",   "title": "Pillars", "span": 7, "items": [ … ] },
  { "id": "loop",    "type": "flow",    "title": "Core Loop", "span": 5, "steps": [ … ], "loop": true },
  { "id": "skeleton","type": "topics",  "title": "Design Skeleton" }
]
```
