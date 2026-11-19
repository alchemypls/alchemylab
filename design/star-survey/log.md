# Star-Survey Portfolio — log

## 2026-11-19 — bridge
Wrote vault/palettes/star-survey.json (11 colors: plum, wine, ember, flame, gold, signal, void, surface, text, text-muted, text-faint) and projects/star-survey.json: theme from the decided tokens (Alchemy's token names filled with the bible's values + the bible's own: frame tints, tracking, display font, glow, motion steps); 6 pages = the sections (/about … /play, status idea, head titles, layout per the Layouts topic); 5 components copied from the library and restyled: Button (action/quiet/danger × sm/md/lg), Frame (from Card; tone reading/hud), Menu + Detail (from Tabs; vertical menu, side by side ≥600 container), Entry list (from Accordion; below 1024), Rail + comms (from Nav Bar). All pages export (HTML + TSX); /live/star-survey/work serves 200.
Gaps (pages/gaps.json): 14 — backdrop layer, fixed overlay slots, in-place sections, content bounds; per-variant states, text-transform + fonts, backdrop filter, decorations, structured list items, reduced motion; leader line, press burst, orb stick, alive glow. Not built; the user picks.
Next: open the project on Web and Live; then Apply step 1 (page-edge look first) or pick gaps to build in Alchemy.

## 2026-11-19 — topic: identity + scope
Decided: pitch ("a software engineer's portfolio you can fly…"), audience (recruiters first, engineers/players second), pillars (the sky is the scene · work in two moves · fireworks are the one motif), voice (calm, precise, warm). References left as a hypothesis (4 proposed, user skipped). One page pages/identity.json for all five.
Scope: everything decided ships, site + game; Apply order 1 foundations + bugs · 2 components · 3 layouts + shell · 4 accessibility · 5 orb stick · 6 fireworks + game calm · 7 content · 8 docs (pages/scope.json).
Needs from the user: URLs, Cori site lines, 8 firework designs, page-edge look, references.
Still blank/hypothesis: iconography, states, performance (wait); pages, stack (hypotheses, as-is).
Next: Bridge (palette + Alchemy project) or Apply step 1.

## 2026-11-19 — topic: responsive + accessibility
Decided (responsive): the orb is the controller, from the user's sketch — center disc = stick, ring button 2 at the top (thumb tip), button 1 at the bottom (thumb base), a side "?" button. Game: stick steers (rim = thruster), 1 = silk hold/slingshot, 2 = recall, side = Cori. Site: stick dials sections (release to go), 1 = next entry / LAUNCH, 2 = previous, side = Cori as guide. Everywhere (touch + mouse), fully on screen, 136/168/200px. Phone: rail dots + current label, LINKS button (hypothesis confirmed), progress under the scanner.
Decided (accessibility): reading frames void/60 (HUD stays /35); text-faint #8A7590 → #9783A0 (Color + every decided page updated); WCAG AA floor, keyboard, landmarks/tablists, live region, document.title per section.
Also: user edited Effects on the canvas — patterns are shippo, seigaiha, asanoha, ichimatsu (plain out; rays and beads stay solid); rules updated. Color's fire-mapping rule marked superseded by Effects (characters keep their colors).
Open: left-handed mirror (hypothesis); Cori site lines (→ Scope); page edge 16/24/48.
Next: Bridge (palette + Alchemy web project) — or the Identity topics / Scope.

## 2026-11-19 — topic: layouts
Decided: three layouts — Readout (About, Skills), Menu + Detail (Work, Projects, Open Source), Launch (Play). Desktop Menu + Detail: intro 540, then menu 280 + 20 + detail 460 = 760 with the gold leader. Below 1024: the selected row opens in place (accordion, one open), no leader. Content stays between the rail (top max(8|14vh, 72px)) and the bottom corners and scrolls inside its Frame. Flip deck row, unused 3-col grid and 50vh phone scroll deleted. Merge map in pages/layouts.json agent.rules.
Components + Structure done except Pages and States. Remaining blank: Identity (audience, pillars, voice, references), iconography, pages, states, Quality (responsive, accessibility, performance), scope.
Next: Responsive + Accessibility (phone rail/comms hypothesis, contrast, keyboard) — or Bridge now that Foundations and Components are decided.

## 2026-11-19 — topic: shell
Decided: sections are hash addresses (/#about … /#play): rail, arrows, wheel/swipe (one step), orb drag and back/forward all go through the hash; the 350vh invisible scroller goes. Comms Plate top-right on home (GITHUB ↗ · RÉSUMÉ ↗ · CONTACT, quiet sm). Launching the game hands off: home shell fades out (DUR.scene), HUD Plates fade into the same corners; Disengage takes comms' corner. One SECTIONS table {id, rail, title} (ABOUT, WORK, SKILLS, PROJECTS, OPEN SOURCE, PLAY). Dev controls only in dev builds. Merge map in pages/shell.json agent.rules.
Open: comms URLs + contact address (user); phone rail/comms (hypothesis → Responsive); per-section <title> (→ Pages).
Next: Layouts — the three section layouts (large panel, panel + menu + detail, launch) on the new Frame/Menu list, desktop and phone.

## 2026-11-19 — topic: content
Decided: one Entry {eyebrow, title, meta, body, tags[], links[]} for Experience, Projects, OSC, Education (replaces the three copies of DeckTab label/detail JSX); Menu row = index/title/meta, Detail = all. Five text parts: eyebrow (mono micro signal spaced), title (Rajdhani 700), meta (mono micro faint), body (Inter 14 muted), chip (mono micro on plum, 2px). Left-aligned everywhere. Entries carry 0–3 links as quiet sm Buttons with ↗. Skills = Readouts (eyebrow + chips); Cori = a line on a Plate. Merge map in pages/content.json agent.rules.
Found: the site has no links out at all (no GitHub, PRs, project, résumé, contact).
Open: the URLs (user); site-wide links → Shell.
Next: Shell & Navigation — what's always on screen (rail, info readout, orb), site-wide links, how the game HUD swaps in.

## 2026-11-19 — topic: effects
Decided: fireworks are the shared motif. Colors: 5 palette sets (wine, ember, flame, gold, plum lifted #6B3A86) + 2 cool sets (teal, violet) kept rare; GOLD #D9B45A → #FFD03B. Shapes: 16 designs → ~8 distinct, 8 patterns → 4 (plain, seigaiha, asanoha, ichimatsu). Press = a mini paper ring (8 petals, role color, clipped, 500ms) on buttons, menu rows, rail dots, the orb node. Calm: still, not gone (fireworks appear open, warp off, glitter/embers ¼, press = rim flash). Characters keep their own colors; Crystal + HoverSparkles deleted; the orb diamond → AR node. Merge map in pages/effects.json agent.rules.
Open: which 8 designs (user picks in the SilkSandbox); cool set rate (~1 in 6).
Next: Content Blocks — the experience entries, skill chips, project items, Cori's lines on the new Frame/Menu list.

## 2026-11-19 — topic: controls
Decided: one Button (replaces gem/Button + 5 hand-rolled HUD buttons + raw sandbox buttons), variants action (outlined gold: gold/10, 1px gold line, gold text, 8px ticks) / quiet (signal/40 line, muted text) / danger (ember, Reset); sizes sm 24 mono 10 · md 32 Rajdhani 12 · lg 40 Rajdhani 16, 44px hit pad on touch. States: no rest glow, hover glow, focus-visible 2px signal ring, press glow-active + contained firework, disabled faint. No scale bounce. Rail labels → buttons, mono 10, current gold. Containers scene updated (rail current gold, LAUNCH outlined). Merge map in pages/controls.json agent.rules.
Open: danger asks twice (hypothesis); the press burst → Effects.
Next: Effects — the contained press firework, fireworks patterns/colors, crystal sets, calm-mode fx.

## 2026-11-19 — direction change: AR overlay
The tarot / crystal-card idea is dropped (too much next to the fireworks, moth and butterfly). The UI becomes a scientific AR overlay: minimal, thin lines, corner ticks, leader lines from things to their menus, faint see-through frames, bright action items; the game is the scene. No echo/mirrored text.
Changed: type display Cinzel → Rajdhani (500/600/700; hero 700) · shape rounded 4/8/16 → square frames + 12px ticks, 2px chips · blur 12px → 4px frost · color: tarot purples deleted · motion: card flip → leader lines drawing in.
Containers reopened as a proposal (hypothesis): Frame, Menu list (replaces flip cards), Leader line, Plate; press → contained muted firework (→ Effects).
Then decided: Containers as drawn (Frame, Menu list, Leader line, Plate); gold/flame for actions, selection and wins only — headings are text (Color updated).
Next: Controls — buttons on the AR frames, HUD controls, rail.

## 2026-11-19 — topic: containers
Decided: Panel (calm surface/90 + blur, rounded-lg, 1px line, gold corners, still wine glint; no nebula inside), Flip card (tarot back plum/wine/gold sun; face = Panel; selected = active glow), Plate (surface/60 + blur, rounded-md) for every HUD group and Cori. Merge map in pages/containers.json agent.rules.
Next: Controls — Button on real tokens (5 variants → how many?), HUD buttons, rail labels.

## 2026-11-19 — topic: motion
Decided: crisp UI, slow sky. Durations fast 150 / base 200 / enter 300 / slow 500 / scene 1000ms; easings standard, enter, exit (+ spring for the rail dot). Reduced motion = calm (loops stop, moves → fades, flip → cross-fade, instant scroll; game play untouched, cosmetic fx toned down). Merge map in pages/motion.json agent.rules.
Open: how much game cosmetic fx tone down → Effects.
Next: Containers — Card's modes and the tarot back on the new tokens; Foundations are done.

## 2026-11-18 — topic: shape
Decided: rounded (sm 4, md 8, lg 16, full), not gem-cut. Glow means alive: no rest glow; hover/focus and active glow in role color; alive list: launch button, active rail dot, selected card, scanner lock, Cori speaking, scan complete. 1px lines, 2px focus ring (signal), one 12px backdrop blur, z ladder 0/20/30/40/50 + Card isolate. Merge map in pages/shape.json agent.rules.
Next: Motion — 23 durations → a few, and reduced motion (none today).

## 2026-11-18 — topic: spacing
Decided: delete the * { margin:0; padding:0 } reset (Tailwind preflight covers it). 8 steps: 2/4/8/12/16/24/32/48. Breakpoints = Alchemy tiers (tablet 600, desktop 1024); md: → tablet:. Page edge 16/24/48 is a hypothesis: the user will look first. Panel column 540px kept. Merge map in pages/spacing.json agent.rules.
Correction: the survey's sm: ×5 / lg: ×2 were object keys; md: is the only breakpoint in use.
Next: Shape & Depth — 10 radii and 20 glows → a few steps, in the new colors.

## 2026-11-18 — topic: type
Decided: Cinzel (display: titles, buttons, caps), Inter (reading), JetBrains Mono (data, HUD, game canvas text). Scale micro 10 / small 12 / body 14 / lead 16 / title 20 / display 28 / hero 48, none below 10px. Tracking wide .1 / spaced .25 / spread .4em. Weights 400/500/700, 900 hero only. Merge map in pages/type.json agent.rules. Specimens in assets/ (type-cinzel.png, mono-jetbrains.png).
Open: none.
Next: Spacing — fixing the * { padding:0 } reset is the first thing, then a spacing scale and the 540px column.

## 2026-11-18 — topic: color
Decided: Cosmic Carnival for site AND game (plum #38194C, wine #941E43, ember #E54F29, flame #F88F05, gold #FFD03B) + plum neutrals (void, surface, line, text, text-muted, text-faint) + signal #3DBDB4 (nebula teal) for information. 12 tokens; merge map in pages/color.json agent.rules. Wine is never text (2.4:1).
Scope change: the game is in scope now. Exempt: star temperatures, nebula/Milky Way/cirrus shaders.
Open: luna moth wing lime (no token); crystal color sets and fireworks → Effects. Effects is a hypothesis: fireworks as the shared motif (fewer patterns, palette colors, buttons/effects mirror the burst).
Next: Type — the display font question (font-display renders nothing; Orbitron never loaded) and 14 sizes → a scale.

## 2026-11-18 — survey
Source: /home/alchemypls/Desktop/code/website/alchemypls.github.io at 96102a3 (+ uncommitted). 40 UI files; src/components/game/** is the backdrop.
Found: 119 color values (92 live), 2 tokens; 45 var(--…) names used and never defined (Button's 24 --btn-*, 7 --glow-*, Text.tsx's); `* { margin:0; padding:0 }` (globals.css:36, unlayered) overrides all 62 p-*/m-* uses; font-display ×15 has no font behind it; 14 text sizes, 8 tracking steps; Button used ×2 of 4 button kinds; 370 lines of dead globals.css; Text.tsx unused; site CLAUDE.md "Design System" describes code that isn't there.
Drawn: index + as-is pages for color, type, spacing, shape, motion, containers, controls, content, shell, layouts. survey.json has every value with file:line.
Hypotheses (not decided): pitch, pages (one route, six in-place sections), stack.
Open: everything else blank. The reset and the undefined Button tokens are bugs to fix in Apply regardless of the decisions.
Next: Decide color — every other page is drawn with it.
