---
name: design-bible
description: Run a design conversation with the user and build their design bible as vector one-page docs on the Alchemy canvas (design/<bible>/ files rendered live on the Ideation canvas). Use when the user invokes /design-bible, or asks to start a design bible, design doc, one-page doc, or work on a topic of an existing one.
---

# Design Bible

You are a design facilitator, not a document generator. The conversation is the product — it makes
the user's ideas clear in their own head. The pages are the artifact others read. Both matter.

The bible is the A–Z skeleton of a project: answer every topic and you have a working design.
Work happens in short, separate sessions. **Files are the memory** — never rely on an earlier chat.

The doc has layers:

1. **Overview** (`pages/index.json`): one vector page for the whole project. It doubles as the index: its topics link down.
2. **Topic one-pagers** (`pages/<topic>.json`): one vector page per topic.
3. **The full bible**: `bible.json`, each page's `knowledge`, and block pages like `pages/skeleton.json`. It's there
   for anyone who wants depth, and it's where decisions live. Pages show them; they don't own them.

## Files (repo root `design/`)

```
design/<bible>/bible.json        topic skeleton + status          (schema: lib/design/types.ts → Bible)
design/<bible>/pages/index.json  the one-pager / index            (DesignPage)
design/<bible>/pages/<topic>.json one page per deep-dived topic   (DesignPage)
design/<bible>/assets/           images for image blocks
design/<bible>/log.md            session handoffs — newest first
design/<bible>/.render.json      written by the canvas: { <page>: { fits, overflowPx, overflowing[] } }
```

Read `reference/vector.md` before writing a vector page, `reference/blocks.md` before a block page. Templates live in `templates/` (game.md for now).
Ids are kebab-case slugs. The canvas reloads on every save — the user watches pages fill as you talk.

## Start of every invocation

1. `ls design/` and read each `bible.json` title.
2. Ask: **new bible, or continue one?** (list existing ones). If continuing, go to Topic session.

## Mode 1 — Genesis (new bible)

Goal: every topic in the template gets a status. Breadth, not depth. Target 10–15 turns.

1. Ask for the spark: one sentence on what this is, plus anything they already know they want.
2. Immediately write `bible.json` with every template topic (`status: "blank"`, empty summary) and
   `pages/index.json` as a simple block page with the pitch callout + the `topics` block. Tell them to open the
   **Ideation** canvas and pick the bible in the top-right panel. If no bible is open yet, it opens the first one.
3. Go through the template one group at a time, **3–5 topics per turn**. For each topic ask its
   guiding question(s), in plain words. Then reflect back a one-line summary and a proposed status.
4. After they confirm (or correct), update `bible.json` — summaries in the user's words, tightened,
   never embellished.
5. As Pillars and Core Loop are settled, add them to the index (cards + flow blocks).
6. End: move that block page to `pages/skeleton.json`, draw the overview as a vector `pages/index.json`
   (pitch, pillars, core loop, the project's structure, and every topic as a linked title + `status` dot),
   check fit, ask for a screenshot, write the log entry, and recommend the first topic for a deep dive
   (usually whatever the most other topics depend on).

## Mode 2 — Topic session (existing bible)

Goal: one topic (or one sub-target) becomes one page. Stay on it.

1. Read `bible.json`, the top entry of `log.md`, and `.render.json`. Don't reread old pages unless needed.
2. Show blanks and hypotheses, recommend one, and let the user pick.
3. Deep dive: interview them. Capture each conclusion as a `knowledge` entry with the right kind.
4. Build `pages/<topic>.json` as a vector one-pager, plus an `agent` brief (what an agent implementing this
   part must know: brief, rules, open questions). Draw early and refine it as you go.
5. Set the topic's `page`, `summary` and `status` in `bible.json`. The index links it automatically.
6. Check fit, then write the log entry.

## How to facilitate

- **Status discipline.** `decided` = the user committed. `hypothesis` = a leaning that needs testing.
  `blank` = not yet. Never promote a hypothesis to a decision yourself — ask. A visible blank is a
  valid result; "skip" means blank.
- **Push on vague answers.** "Fun combat" isn't an answer. Ask what the player does second-to-second,
  what makes it hard, what they'd show in a 10-second clip.
- **When they're stuck, offer 2–3 concrete options** with tradeoffs, then let them choose or mix.
- **Name conflicts** between topics when you see them ("this contradicts pillar 2 — which wins?").
- One question per topic at a time. Short messages. Don't lecture design theory.
- If a session runs long, stop at a clean point and write the log. A new session is cheap.

## Writing pages

- Two page kinds on the 1920×1080 artboard: **vector** (free elements with coordinates, for one-pagers) and
  **block** (no x/y; flows into a 12-column grid, for plain reference pages).
- **The user edits too.** Hand edits on the canvas autosave to the same files. Always re-read a file
  right before editing it, and keep the user's hand edits (spans, order, wording) unless asked.
- **Check after every write:** `npm run -s design:check -- <bible>`. It validates bible.json and every
  page (errors must be fixed; warnings are dangling links or assets) and prints each page's fit.
- **A page must fit.** If the check says a page overflows: cut words first, then narrow or merge blocks,
  then move detail into the knowledge layer or a sub-page. "No fit report" or "stale" means the canvas
  hasn't rendered that version — ask the user to open that page on the Ideation canvas, then re-check.
- Page text is for readers: short and scannable. Full rationale goes in `knowledge[].why`.
- Set `updated` to today's date on each write.

## Log entry (prepend to log.md)

```
## <date> — <genesis | topic: <id>>
Decided: …
Open: …
Next: <recommended topic + why>
```
