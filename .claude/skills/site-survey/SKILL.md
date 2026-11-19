---
name: site-survey
description: Take an existing codebase (usually a website) and build its UI design bible from what the code actually does — an as-is survey of every style value and component, drawn as vector pages on the Alchemy Ideation canvas, then decide sessions that settle one true version per topic, then a bridge into an Alchemy web project (palette, theme, pages) and applying the decisions back to the real code. Use when the user invokes /site-survey, or asks to survey, audit, reverse-engineer, unify the styles of, or make a design doc from an existing site or codebase.
---

# Site Survey

design-bible run backwards: the code answers first, the user decides. Same files, same canvas, same rules —
read `.claude/skills/design-bible/SKILL.md` (facilitation, status discipline, page writing, fit, log) and its
`reference/vector.md` before writing a page. This file covers only what differs.

The target codebase is somewhere else on disk. **Never edit it during Survey, Decide or Bridge**; only in Apply,
one topic at a time, and never commit there (its own repo, the user's call). Alchemy's own `design/` gets the bible.

## Files (Alchemy repo root)

```
design/<site>/bible.json            template "web" (topics: design-bible/templates/web.md), plus "source": the codebase path
design/<site>/survey.json           the inventory: raw facts from the code, written once per survey, re-run to refresh
design/<site>/pages/index.json      overview + index: topics row (decided) and a separate "As-is" row
design/<site>/pages/asis-<topic>.json  dated snapshot of what the code does today. Written by Survey, then never edited
design/<site>/pages/<topic>.json    the decided page, written in a Decide session; links to its asis- page ("was → now")
design/<site>/log.md                handoffs, newest first (same format, entry kinds: survey | topic: <id> | bridge | apply: <id>)
vault/palettes/<site>.json          the decided colors (Bridge)
projects/<site>.json                the Alchemy web project (Bridge)
```

**As-is pages are history, kept separate.** Their topic link is the decided topic; they never get a `status` dot and
never appear in the topics row. The index shows them in their own "As-is" row/band, titled with the survey date. A
re-survey writes new snapshots `asis-<topic>-<date>.json` and leaves the old ones.

## Start of every invocation

1. `ls design/`; for any bible with `"template": "web"` read its title and `source`.
2. Ask: survey a new codebase (which path?), or continue one. Continuing: read `bible.json`, the top of `log.md`,
   and recommend the next mode (Decide → Bridge → Apply), the user picks.

## Mode 1 — Survey (no questions until it's drawn)

1. **Read the codebase's own docs first** (README, CLAUDE.md, package.json): stack, styling system, routes, what's
   out of scope. Separate the **UI layer** (shell, panels, controls, content, effects) from things that aren't page UI
   (a game, a canvas, 3D scenes, data scripts): those get one line in `stack` and count as the backdrop, nothing more.
2. **Inventory with scripts, not by eye.** Write throwaway scripts in the scratchpad that grep the source (skip
   node_modules, build output, archives) and emit JSON. Collect, each with count + `file:line` list:
   - colors: hex, rgb/rgba/hsl, named, Tailwind palette classes (`text-cyan-300`) and arbitrary values (`bg-[#0af]`);
     cluster near-duplicates (ΔE < ~3, same hue with alpha steps) so drift shows as groups
   - type: families, sizes, weights, letter-spacing, line-heights, text-transform
   - spacing: padding/margin/gap values, Tailwind steps and arbitrary ones; max-widths, breakpoints in use
   - shape & depth: radii, border widths/colors, box/text shadows, blurs, backdrop filters, clip-paths
   - motion: durations, easings, framer-motion variants/transitions, keyframes
   - components: each UI component file — props, variants, where it's used (import count); and repeated inline
     patterns that should be one component (same class string shape in 3+ places)
   - structure: routes, sections/states switched in place, layout modes, what's fixed on screen
   - tokens that already exist (CSS vars, @theme, Tailwind config) and how often they're bypassed
3. Write `survey.json`: `{ source, commit, date, topics: { <topic id>: { facts…, drift: "one line" } } }` keyed by the
   web template's topic ids. Keep raw lists; pages show the summary.
4. Write `bible.json` with every template topic: `blank`, except where the code already settles one cleanly
   (a single font everywhere → `hypothesis`, summary "as-is: …"). Never `decided` — only the user decides.
5. Draw the **as-is pages**, the most drifted topics first (usually color, type, containers, controls, spacing).
   One page per topic, to read at a glance:
   - colors: swatches grouped by cluster, each with its count; clusters that should be one value side by side
   - type / spacing / radii / shadows: every value on a scale strip, with counts, outliers marked
   - components / containers: one row per variant found, a drawn sketch of each (rects + text, not screenshots),
     where it's used, and which ones are really the same thing
   - shell / pages / layouts: the screen as boxes per section or layout mode, at desktop and mobile
   Each page carries a `knowledge` entry per finding (`evidence`, with `file:line`) and a kicker "As-is · <date>".
6. Draw `index.json`: pitch, the topics row (status dots), the As-is row (links), and the survey's headline numbers
   ("160 colors, 2 tokens"). Check fit, ask the user to open the bible on Ideation, log, recommend the first Decide topic
   (usually color: everything else is drawn with it).

## Mode 2 — Decide (one topic per session)

Like design-bible's topic session, seeded by the as-is page instead of a blank:

1. Show the drift for the topic in two lines and propose a **canonical set**: the fewest values that cover what the
   site actually needs, named by role (`surface`, `accent`, `text-muted`; `size-sm…xl`; `space-1…8`). Mark which
   existing values merge into each. Offer 2–3 options where the choice is real (keep the glow cyan or move to violet).
2. The user picks, corrects, adds. Record each as `decision` knowledge with `why`; the merge map (old value → token)
   goes in the page's `agent` brief `rules`, so Apply can follow it mechanically.
3. Draw `pages/<topic>.json`: the decided set big and clear, a small "was" strip linking to `asis-<topic>`.
4. Set the topic `decided` (only on the user's word), `page`, summary. Fit, log.

Order: color → type → spacing → shape → motion → containers → controls → effects → content → shell → layouts → the rest.
Foundations before components: a component's page uses the decided tokens.

## Mode 3 — Bridge (after the foundations are decided)

1. `vault/palettes/<site>.json` from the color decisions (`{ title, colors: [{name, value}], project: "<site>" }`). The
   bible id, the web project id and the vault items' `project` are the same id: that's one workspace project in Alchemy's
   header picker.
2. `projects/<site>.json` — read `lib/project.ts` (ProjectData) and an existing file in `projects/` first, keep the shape:
   - the project theme: decided tokens as token → raw CSS value
   - pages: one per page **or per in-place section** (a section switched without a route becomes its own path), each
     with `head`, `intent`, `status: 'idea'`, and a layout from the decided `layouts` topic
   - components: recipes from `lib/library` where one fits (copied, themed); a new recipe where a content shape is plain
     HTML/CSS; anything that needs runtime code the recipe format can't express (glass, particles, WebGL) stays out
3. Write a **gaps** page (`pages/gaps.json`, block page is fine): what the site needs that the Web canvas / recipe format
   can't do yet (backdrop layers, overlay panels, in-place sections, effects as components…), each a one-line to-do for
   Alchemy. The user decides which become Alchemy work; don't build them from this skill.
4. Tell the user to open the project on Web and Live. Log.

## Mode 4 — Apply (one topic at a time, in the target codebase)

Rework the real code to the bible, the hybrid way: pages simple enough to rebuild come from the Alchemy export; the
rest is edited by hand to match the decisions.

1. Re-read the topic's decided page and its `agent` brief (the merge map). Re-scan only that topic's values (the survey
   may be stale): list every site to change before changing any.
2. Introduce the tokens where the codebase keeps them (its CSS vars / `@theme`), then replace raw values with tokens
   following the merge map. Values not in the map: stop and ask, don't guess a token.
3. Build or lint the target the way its own docs say. Visual check: the user looks (Live, or their dev server); don't
   spin up a browser to screenshot.
4. Re-run that topic's inventory: the count of raw values left is the result. It goes in the log entry, not on the
   as-is page (that's history): `apply: color — 160 raw → 14 tokens, 3 left on purpose: …`.

## Habits

- Facts from the code are `evidence`; the user's choices are `decision`; your proposals are `hypothesis` until picked.
- Count, don't characterise: "6 button styles in 9 files" beats "buttons are inconsistent".
- Personal data in the target (names, résumé text) stays on disk in the bible; it never goes to outside services.
- Re-read any page before editing it — the user edits on the canvas too.
