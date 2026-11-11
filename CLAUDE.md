# Alchemy — CLAUDE.md

Codebase guide for Claude Code. Read this before touching anything.

---

## What this project is

Alchemy is a design-to-build workbench: four full-screen canvases, one job each, laid out on a 2×2 grid (Alt + WASD /
arrows moves between them). Design docs and game pieces live as files on disk (design/, vault/, projects/) that the
canvases and the agent both read and write. Web projects are laid out from a component library and export as native
HTML/CSS (or a Next.js page), and the Live canvas runs them for real.

The Workbench is built with React and Tailwind. That has zero bearing on what it outputs. See **Output purity** below.

---

## Canvases

One canvas, one job (`lib/scenes.ts`, grid: Ideation | Fab over Live | Web). Every canvas shares one shell: tool rail left, panel right (pickers, controls, minimap with layer pips left of it, toggles for the box under it).

| Canvas | Job | Status |
|---|---|---|
| **Ideation** (`ideation`) | Design bible pages; the page is the canvas | `workbench/canvases/IdeationCanvas.tsx` |
| **Fab** (`fab`) | One editor at a time makes assets for the other canvases: Visual Identity, Components, Blocks | `workbench/canvases/FabCanvas.tsx`, same layout as Ideation. Visual Identity edits vault shapes, icons and palettes; Blocks edits vault blocks (game pieces drawn on their footprint tiles, isometric grid with corner snapping); Components saves to the current project (`useCurrentProject`) |
| **Web** (`web`) | Test page and app layouts, quick prototypes | `workbench/canvases/WebCanvas.tsx`, same shell as Ideation: one page of a web project at its device size, three layers (wireframe → layout → preview; 1/2/3, Ctrl + mouse wheel, pips on the minimap), the ones under it see-through. The wireframe is a vector page per tier (`PageSketch`), drawn with Ideation's tools (images stay in the browser: `src: idb:<id>`). Panel: project + page pickers, device bar; box under the minimap: **page** (intent, status, head, notes), **routes** (the route tree), **project**, **layers** (wireframe). Layout layer: pick a component in the **components** box and click the page (or drag it in), drag blocks to move, corner to resize (snaps to the tier's columns and rows; wider tiers write their own override), hide per tier, Del deletes; the selected block's fields fill the box; **variants** = alternative layouts. Preview is read-only so far. **code** box: the page's output as plain HTML or a Next.js page (copy, download, open the HTML in a tab) |
| **Live** (`rnd`) | The web project running for real, like browser dev tools | `workbench/canvases/LiveCanvas.tsx`: the page served at `/live/<project>/<route>` (the HTML export + live reload + a console bridge, `lib/live.ts`) in a frame at a device's size. Devices are its layers: one per tier (1/2/3, Ctrl + wheel, pips), DeviceBar in the panel. Boxes: **console** (the page's logs/errors + load numbers), **checks** (`lib/liveChecks.ts`: broken links, overlaps, hidden blocks, missing text/alt), **phone** (Share on this Wi-Fi: a read-only gateway for phones, Live pages only, off after 30 min; same page on a real phone, reloads itself on save). Following a link in the page opens that page on Web too |

`workbench/shell/CanvasPanel.tsx` sits above every canvas (switcher, vault). A canvas adds its own controls with `CanvasPanelSlot` (`area="below"` for a tall box like properties).

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router, `"use client"` for canvas) |
| State | Zustand (`lib/store.ts`) |
| Animation | Framer Motion (canvas slide transitions, small UI motion) |
| Styling | Tailwind CSS v3 |
| Language | TypeScript strict |

---

## Directory map

```
app/
  page.tsx          — root: the active canvas (slide transition), CanvasPanel, SceneNavigator, FileVault; starts project sync
  api/design/route.ts       — design bible files (design/<bible>/): list, bible.json, pages, assets; PUT writes (validated, x-base-mtime → 409 on conflict)
  api/design/watch/route.ts — SSE: one message per changed file under design/ (shared fs.watch)
  api/design/fit/route.ts   — PUT: page fit report (with pageHash) → design/<bible>/.render.json
  api/vault/route.ts        — vault assets and palettes (?type=palette / ?palette=id): list, PUT (validated, x-base-mtime → 409), DELETE (409 + usedIn unless force), ?uses=id
  api/vault/watch/route.ts  — SSE: one message per changed file under vault/
  api/projects/route.ts     — web projects (projects/<id>.json): list, get, PUT (validated, x-base-mtime → 409), DELETE
  api/projects/watch/route.ts — SSE: one message per changed project file (the Web canvas and every /live page listen)
  api/lan/route.ts          — this machine's LAN addresses; PUT {on} turns phone sharing (lib/server/phoneShare.ts) on/off
middleware.ts       — /api and /live answer only requests addressed to localhost (no DNS rebinding, a deployed copy refuses)
  live/[pid]/[[...path]]/route.ts — a project's page as a browser gets it (lib/live.ts)
  api/pen/route.ts  — pen bridge SSE stream (?source=local|remarkable): spawns scripts/pen-bridge.py per source on first client, kills on last (local dev only)

scripts/
  design-check.ts    — `npm run design:check [-- <bible>]`: validate bibles + report page fit (runs via jiti; relative imports only)
  run.cjs            — runs a TS/TSX script with the app's own imports (`@/`, .tsx components) via Next's SWC + jiti
  parts/             — vault assets as code: kit.ts (helpers in inches: block/shape, disc, box, capsule, poly, ring, upright, wall), one file per
                       part. `npm run parts:build [-- <id>…] [--force]` writes vault/assets/<id>.json, validated; leaves a file alone when it
                       matches, refuses one edited on Fab since its last build (record in .render/parts.json)
  asset-render.tsx   — `npm run asset:render -- <id>… | --all [--view iso|top|both] [--turn N] [--mirror] [--size px]`: PNGs in .render/
                       through the canvas's own PosedAsset (+ .render/sheet.png for several). Needs inkscape + ImageMagick
  page-render.tsx    — `npm run page:render -- <bible> <page> [--crop x,y,w,h] [--width px]`: .render/<bible>-<page>.png through the real
                       VectorArtboard (vault primed from disk; text swapped to plain SVG text, so wrapping is approximate)
  asset-info.ts      — `npm run asset:info [-- <id>…]`: assets in inches, one line per asset or per element (read this, not the JSON)
  pen-bridge.py      — pen → JSON lines. `local`: grabs a USB tablet's evdev (EVIOCGRAB). `remarkable`: mirrors a Paper Pro pen over SSH (no grab — keeps inking on paper). Stdlib Python
  udev/70-alchemy-pen.rules — per-device `uaccess` rule so the bridge can read the tablet (never add the user to `input`)

vault/assets/<id>.json — global vector assets (shapes, icons, blocks): made on Fab, placed on pages with an `asset` element, so an edit shows everywhere. The agent can write them too
vault/palettes/<id>.json — named colors. Every color picker shows the one in use (store.swatchPalette); Components' theme colors pick from it. Picks copy the value
projects/<id>.json — web projects (ProjectData): written by the Web canvas through lib/projectSync.ts, served by /live. The agent can read and edit them (keep the shape; wireframe images stay in the browser as `idb:` refs)

design/<bible>/      — design bibles (agent + user content): bible.json, pages/*.json, assets/, log.md. Written by the
                       design-bible skill (.claude/skills/design-bible/), rendered by the Ideation canvas

lib/
  design/types.ts    — Bible / Topic / DesignPage / Block (semantic blocks, no x/y) / FitReport; ARTBOARD 1920×1080
  design/ops.ts      — pure edit ops (add/update/move/resize/duplicate/remove block, knowledge, topic) — all hand edits go through these
  design/vector.ts   — vector page elements (rect/ellipse(superellipse n, scalloped `lobes` for bushes)/capsule/poly/line/text/image/status/stroke/zone), planes (floor/left/right isometric mapping), solids (`extrusion`: a hull for convex shapes, walls swept edge by edge for dented ones), geometry, placement grid, pure ops; text + status bind live to bible topics; eraser marks (`erased`, drawn as masks: Fab rubs out anything, Ideation's eraser cuts ink only); groups (`group`: welded elements select and move as one) and the clipboard ops (copyElements/pasteElements: across pages, layers come along)
  design/layers.ts   — named layers on vector pages and vault assets: draw order, hidden/locked, stamping new elements, ops, validation
  design/palette.ts  — Palette format, BASE_PALETTE fallback, sheet layout, validatePalette
  design/vault.ts    — VaultAsset (a vector page with a kind: shape/icon/block), what part of it places and at what size, a block's footprint + footing (scaled to the floor's tiles), fitBlocks (placed blocks follow their vault size; Ideation only moves/tints/turns them), turnedAsset/shownBlock/blockPose (a placed block's `turn` + `mirror`: isometric = rebuilt by quarter turns, top-down = any angle; one place says how a posed block draws), blockProjection (iso↔flat: the floor plane maps tile for tile) + projectedElements (top-down, walls squash to their base edge), placeAsset, tint
  server/fileWatch.ts — shared fs.watch → SSE for a folder
  design/toolStyles.ts — what each drawing tool makes next + favorites: types, defaults, conversion to element fields (saved per browser by useToolStyles)
  design/lifecycle.ts — every tool, action and effect has a stage: lab → stable → retired. Retired leaves the menus, keeps drawing; nothing is deleted automatically
  design/actions.ts  — the action registry: one-shot things done to the selection or page (duplicate, copy/paste, group, front/back, flip, quarter turn, delete), pure. The keys, the right-click menu, the inspector header and the selection bar all read it
  design/transform.ts — flipElements / quarterTurn: a selection as one piece, about its middle (shapes lying in a plane flip in place)
  design/fx/         — effects: an element's `fx` stack (index.ts: FX registry, the drawing pipeline, checkFx). One file per effect (roughen: reshapes the outline; blur: an SVG filter); its params drive the sliders and validation
  design/validate.ts — validatePage/validateBible (API writes + design:check), pageHash; relative imports only
  routes.ts          — a project's pages as a route tree (buildRouteTree), normalizePath, nameFromPath
  project.ts         — ProjectData/PageDef/PageHead/PagePlacement types, tier cascade (resolvePlacement), wireframes per tier
  projectSync.ts     — keeps store.projects and projects/ on disk in step (load, debounced writes, watch; disk wins a conflict; carries a browser's pre-disk projects over once)
  live.ts            — livePage(): the HTML export + links kept inside /live + live reload + console bridge (posts to the Live canvas)
  liveChecks.ts      — problems across a project's pages, for the Live canvas
  generator/page.ts  — a page's output, two formats from the same parts (pageParts): generatePageTSX (Next.js page: `metadata` export, next/script) and generatePageHTML (one plain HTML file: head tags, inline <style>, behaviors in a <script>). Responsive CSS grid (mobile-first @media per tier)
  store.ts           — Zustand store: projects (working copy; disk via projectSync, not persisted) + project edit actions, and this browser's view (canvas, page, Fab editor, palette, vault window), persisted
  scenes.ts          — the canvas grid and navigation helpers
  assets.ts          — IndexedDB blob store for sketch images (putAsset/useAssetUrl); state keeps only assetId
  devices.ts         — breakpoint tiers (mobile-first: mobile <600, tablet ≥600, desktop ≥1024), tierOf(), DevTools-style device presets
  penCalibration.ts  — per-source pen area calibration + sideways hold (localStorage), boundsFromTrace(), penToSheet()
  sketchErase.ts     — precise (partial) eraser: cuts strokes, converts touched shapes to strokes
  library/           — the component library. Fabricator, the Web canvas and generator/page.ts all use this.
    theme.ts          — Theme = token name → raw CSS value; GLOBAL_THEME; each project owns a COPY (copyTheme)
    recipe.ts         — Recipe format: anatomy (part tree) + props + variant axes + states + named behavior; ProjectComponent (a project's owned copy, with `origin`)
    css.ts            — recipe + theme → native CSS (tokens → CSS vars, variants → [data-*], states → pseudo-classes); optional selector scope
    markup.ts         — recipe + a placement's props/options → native elements (JSX-compatible, or plain HTML with `html`); shared by exported code and RecipeView
    edit.ts           — pure recipe editing: style layers (base / variant option / state), addOption/removeOption
    sets.ts           — library "box sets": Core (Button, Field, Card), Navigation (Nav Bar + Brand, Nav Link), Carousel (Carousel + Hero Slider, Media Card), Content (Tabs + Accordion). LIBRARY = all sets' recipes
    recipes/          — recipe files per set. Format supports: list props + `repeat` parts ({item.*}), part-level `states`,
                         `responsive` deltas (emitted as @container queries — content areas set container-type: inline-size)
                         `when: "item.x"` (per-item conditions); scroll tracks (scroll / snapAlign / basis / aspect / objectFit)
    behaviors/        — runtime catalog (BEHAVIORS): self-contained JS per behavior (carousel incl. autoplay, tabs). Recipes NAME a
                         behavior + settings (`behaviors: [{type, params}]`); parts mark roles with data-role; controls use
                         `untilReady` (hidden until the runtime attaches). RecipeView runs the runtime on the preview;
                         generator/page.ts embeds the same source (fn.toString) in the export — preview = output

workbench/
  canvases/
    LiveCanvas.tsx               — the project running at /live in a device frame; console, checks, phone
    IdeationCanvas.tsx           — one bible page live from disk, full screen: pan/zoom, tool rail, page controls + map in CanvasPanel. Read is a tool (H)
    FabCanvas.tsx                — editor + file dropdowns; the rail shows each editor's tools. Same shell as Ideation
    WebCanvas.tsx                — a web project's page in layers (wireframe, layout, preview), see-through; route tree + page fields in the panel box
  hooks/
    useCurrentProject.ts   — the project the canvases work on (lastProjectId, else the first)
    useDesignDoc.ts        — loads a bible + page from design/, follows disk over SSE, saves with mtime conflict checks
    useDesignEditor.ts     — useFileDraft (any file: local draft, undo, autosave, conflicts) + useDesignEditor (useDesignDoc + draft + fit reports)
    useVault.ts            — vault assets + palettes live from disk, one shared copy and watch; create, save, delete
    useTrace.ts            — tracing image under a sheet: per browser (IndexedDB blob `trace-*` + localStorage settings), never in the file
    useSheetView.ts        — pan/zoom over one sheet, fit, recenter, view keys (shared by full-screen canvases)
    useVectorTools.ts      — tool in hand, selection, active layer (its `apply` puts new elements on it), tool menu changes, pen, drawing keys, the artboard's `edit` (vt.edit), for any canvas editing a vector page (Ctrl + wheel steps the active layer on Ideation and Fab)
    useToolStyles.ts   — each drawing tool's settings + favorites, in localStorage
    useSheetPen.ts         — tablet pen on the fixed Ideation sheet: source, sideways hold, calibration, off-sheet handling
    usePenBridge.ts        — subscribes to /api/pen while enabled (pen is grabbed only while subscribed)
  ui/
    Slider.tsx        — NotchedSlider: snap-to-notch, pill badges, hover tooltip
    SectionLabel.tsx  — uppercase tracked-out section heading (sm/md sizes)
    Toggle.tsx        — pill switch (sm/md sizes)
    PickList.tsx      — app-drawn dropdown (groups, stays open until a pick); used where a native select closed on release (Fabricator)
    TextInput.tsx     — styled text input with className passthrough
    SketchStroke.tsx  — sketch stroke renderer; per-segment width when the stroke has pen pressures
    DeviceBar.tsx     — DevTools-style viewport bar: grouped device dropdown/Responsive, W×H inputs, rotate, tier badge
    DesignArtboard.tsx — block DesignPage → fixed artboard: blocks flow into a 12-col grid; measures + reports overflow; edit = select + span grip
    DesignInspector.tsx — block page edit panel: page fields, add block, per-type block fields, knowledge layer, topic status
    VectorArtboard.tsx — vector page as SVG: render, link navigation, fit report; edit = drawing tools (select/shapes/attached arrows/text/pen/erase). Its parts in vector/:
    vector/           — gesture.ts (tool + gesture types, geometry helpers), useGestures.ts (the pointer engine), shapes.tsx (how each element draws, PosedAsset), overlays.tsx (selection, handles, footprints, previews), clipboard.ts (Ctrl+C/X/V between any vector sheets, per browser)
    VectorKit.tsx     — the vector tools' UI every vector canvas shares, fed by useVectorTools: VectorRail, VectorToolMenu, VectorBox (layers + properties)
    SheetShell.tsx    — a full-screen canvas's frame: SheetSurface (pan/zoom), Sheet, Banner, EmptyNote, SaveDot
    fab/              — Fab's panel parts: AssetFile (file box, FootprintPicker, DimsInput; a file's kind is fixed, "Copy as" makes a new file of another kind), ComponentFilePicker
    VectorInspector.tsx — vector page properties panel: geometry, style, text + topic binding, link, z-order
    ToolRail.tsx      — left tool rail: one master tool list, each canvas or editor shows a subset
    SheetPanel.tsx    — CanvasPanel contents for full-screen canvases: dropdowns, control row, minimap (layer pips docked outside the panel on its left, MAP_RAIL; `rail` for a canvas's own), panel toggles, box below; TraceFields (tracing image, in the page / file box), TraceMover
    Fabricator.tsx    — Fabricator parts (useFabricator, list, stage, options, styling): Library + project copies, layer style editor, theme editor
    LayersPanel.tsx   — a vector page's layers in the box under the minimap: active layer, hide, lock, rename, reorder, per-layer element list; right-click a layer for its menu (rename, select all on it, hide, lock, move, delete)
    PaletteEditor.tsx — a palette on Fab: swatch sheet + panel fields (colors, name, use in pickers)
    AssetPicker.tsx   — AssetThumb: a vault asset drawn small, for the Vault panel
    vault/VaultParts.tsx — the vault window's parts: VaultWindow (drag, resize, kept in the store), VaultSearch + flyout chips, VaultTabs, slot grid (useSlotGrid, packSlots, GhostSlot)
    AuxDock.tsx       — auxiliary bars that float outside a panel's edge: Docked (wrapper; side + align + gap), AuxBar (pill shell), AuxButton
    FxFields.tsx      — an effect stack as controls (a card per effect, sliders from its params, + add): the inspector (selection) and the Shapes tool menu (next shape)
    vector/actions.tsx — the action registry on screen: icons (optional, else the glyph), runAction (applies, selects, keeps the clipboard), SelectionBar (the `bar` actions, docked left of the properties box)
    SheetMenu.tsx     — right-click menu on a vector sheet (Ideation, Fab): duplicate, front/back, plane, Edit in Fab, delete; Select all on empty. useRowMenu: the same menu on a right-clicked row in the layers box or the selection list
    ToolMenu.tsx      — tool panel beside the rail: favorites bar + the tool's parameters; Snap to grid (styles.select.free) on select/shape/text
    StyleFields.tsx   — controls shared by ToolMenu and VectorInspector: notched sliders, swatches (palette in use), segmented picks, border fields, transparency
    web/              — the Web canvas's parts: CodeBox (output), WebLayers (sketchPage/pageSketch, WireframeLayer, LayoutLayer, PreviewLayer, PlacementCell), LayoutEditor (+ ComponentsBox, VariantsBox, newPlacement, readingOrder), BlockFields (BlockInspector), RouteTree, PageFields, ProjectFields, WebChrome (minimap, layer pips, column bands)
    PageMap.tsx       — Ideation minimap: elements simplified by type, viewport box, click to move
    RecipeView.tsx    — renders a recipe live as native elements + RecipeStyles (generated CSS, scoped per project)
    InstanceControls.tsx — option/prop pickers for ONE use of a component (Fabricator preview, a Web layout block)
  shell/
    SceneNavigator.tsx      — scene grid navigation (arrows + labels)
    CanvasPanel.tsx         — top-right panel above all canvases: switcher, per-canvas slot (CanvasPanelSlot), vault button
    VaultButton.tsx         — file vault toggle, at the bottom of CanvasPanel (Ideation and Fab only)
    FileVault.tsx           — the file vault window (vault/ on disk) on Ideation/Fab: search, sort, tabs per kind, slots (long blocks take two), hover card (size, delete), drag to reorder (per browser) or onto an Ideation page to place there (VAULT_DRAG). Ideation picks arm placing (store.vaultArmed) or set the color pickers' palette; Fab picks open the file. Right-click (VaultMenu): place/open, Edit in Fab, Duplicate, Copy as another kind (new files, opened on Fab), delete
    Ask (workbench/ui/Ask.tsx) — the app's own name box / confirm / notice: await askText / askConfirm / tell (AskHost in app/page.tsx). Never window.prompt/confirm/alert: VS Code's browser refuses them
    PopMenu (workbench/ui/PopMenu.tsx) — the frame every right-click menu shares (SheetMenu, VaultMenu): portal, kept on screen, closes on a press elsewhere/wheel/Esc
```

---

## Architecture rules

**Canvases are full-screen components, not widgets.** Each one renders its sheet with `useSheetView` (pan/zoom), its tool rail, and its panel with `SheetPanel` portaled into `CanvasPanel` (`CanvasPanelSlot`). Only the active canvas is mounted. Layers on a canvas are picked with pips left of the minimap, 1/2/3 and Ctrl + wheel.

**Local only, safe by default.** The API reads and writes this computer's files with no login, so nothing else may reach
it: `npm run dev`/`start` listen on 127.0.0.1, `middleware.ts` refuses requests not addressed to localhost, and phones
get Live pages only through the read-only gateway (`lib/server/phoneShare.ts`: GET /live/… and the reload stream, off
after 30 minutes). Keep it that way: never bind the app to the network or widen the gateway's allow-list.

**Files on disk are the source of truth, shared with the agent.** Design bibles (`design/`), vault assets and palettes (`vault/`), web projects (`projects/`): each has an API route that validates writes and refuses stale ones (`x-base-mtime` → 409), and an SSE watch so the canvases follow edits made elsewhere (the agent, another tab). Browser storage holds only this browser's view (open canvas/page, tool styles, tracing images, vault order).

**Projects.** Everything page-shaped — pages, layouts, wireframes, components, theme, the device — lives per project in `ProjectData`, one file per project in `projects/`. The store keeps the working copy (`store.projects`), so canvases edit through the store's actions as before; `lib/projectSync.ts` writes changes to disk and pulls outside changes in. Web, Live and Fab's Components follow `lastProjectId` (`useCurrentProject`) and `project.activePath`, so picking a page anywhere switches them together.

**Component library (v2) — copy, don't link.** `lib/library` holds global recipes and the global theme. A project owns copies: `project.components[id]` (`ProjectComponent`, with `origin`) and `project.theme`. Editing a project's copy never reaches the library or another project. Within a project every placement references the project's one copy; a placement carries only its own `options` (variant picks) and `props` (text etc.). To make one use look different: set its options → or add an option to the component → or duplicate the component. Native-first output: real `<button>`/`<input>`/…, CSS variables, `[data-*]` variants, browser pseudo-classes — no runtime dependencies.

**Behaviors — the JSON names, the catalog implements.** Dynamic features never put code in a recipe: `recipe.behaviors` names a runtime from `lib/library/behaviors` with settings, and the runtime is a self-contained function (no imports — its source is copied into exported pages). Progressive enhancement is the rule: the component must work without the script; behavior controls ship `hidden` (`untilReady`). Runtimes use only Baseline-widely-available browser APIs.

**Breakpoints are mobile-first tiers** (`lib/devices.ts`): `mobile` / `tablet` (≥600) / `desktop` (≥1024). Page wireframes are stored per tier (`project.wireframes[path][tier]`, `PageSketch`). Layout placements are mobile-first: base `col/row/span/hidden` = mobile (4 cols); `at.tablet` / `at.desktop` hold only overrides, and `resolvePlacement(p, tier)` cascades upward, scaling inherited geometry to 8 / 12 cols. The device lives on the project (`project.viewport`) for the Web canvas; Live keeps its own per tier. `generator/page.ts` emits the same cascade as mobile-first `@media (min-width)` CSS.


---

## Output purity — the Workbench is not its output

**Recipes and themes store raw web values, never workbench or framework identifiers.** A recipe (`lib/library/recipe.ts`) holds CSS property values, token names, semantic part kinds, variant axes, states and named behaviors; a theme holds token → raw CSS value. No Tailwind classes, React props or JSX patterns.

**The generator is the seam.** `lib/generator/page.ts` turns a page into output; formats are added there, not in the recipe format. Today: plain HTML (`generatePageHTML`, what Live serves) and a Next.js page (`generatePageTSX`), both from the same `pageParts`. The Web preview (`RecipeView`) and the export use the same `css.ts` / `markup.ts`, so what the preview shows is what ships — keep it that way: a recipe field that the preview renders must reach both outputs.

**Test for a new recipe field:** can a plain HTML/CSS output use the value without translation? If not, it belongs in the generator.

---

## Git — commits are the user's call

**Never commit or push, and never ask or offer to.** Not after finishing a task, not "should I commit?", not as a
suggested next step. Earlier approval doesn't carry over: "go ahead" on a task means the task, never a commit.
The only thing that allows a commit is the user running **`/nowyoumaycommitdonkey`**. It covers that one run: commit
the work as the skill says, then the rule applies again. A push needs the same skill run, with `push` in its arguments.

---

## Dev commands

```bash
npm run dev      # start dev server on :3000
npm run build    # production build
npm run lint     # ESLint
npm test         # unit tests (Vitest); npm run test:watch while working
npm run parts:build / asset:render / asset:info / page:render   # vault parts as code, pictures of them and of pages, summaries (see scripts/)
```

`npm test` runs a few tests (Vitest, Node only, `*.test.ts` next to the code), kept small on purpose: only what's easy to break and costly when it does. The edit ops every tool uses (duplicate, copy/paste, groups, floors carrying pieces, locked layers), the export (escaping, both formats ship the same, the mobile-first cascade), the API's guards on disk (stale saves 409, invalid 422, ids can't leave their folder, vault pieces in use), the phone gateway's allow-list, and every registered action and effect (tools.test.ts: the page still validates; flips and turns undo themselves). CI also runs `design:check` (every content file) and `parts:build -- --check` (each part matches its vault file). Add a test when a bug is fixed (one that failed first) or a new guard appears, not for coverage. Canvas interactions aren't automated: verify UI changes by running dev and exercising the canvas.

---

## Patterns to follow

- **Adding a rail tool:** add it to the master list in `workbench/ui/ToolRail.tsx`, then to the canvas's subset (`toolsFor([...])`); drawing tools get their settings in `lib/design/toolStyles.ts` and a menu in `ToolMenu` (and `MENU_TOOLS` in `VectorKit`); the gesture goes in `vector/useGestures.ts`.
- **Adding a tool: pick its kind, then add one entry.** Every new tool starts at stage `lab` (a sky dot or tag in the UI);
  `stable` once it's earned it; `retired` to take it out of the menus while files that use it keep drawing. Never delete
  one automatically; that's the user's call.
  - *An action* (done once to the selection: flip, align, boolean): a pure op in lib/design, then an entry in `ACTIONS`
    (`lib/design/actions.ts`): label, glyph, keys, `bar` for the selection bar, `when`. Keys, menus and bar pick it up.
  - *An effect* (a lasting look on an element: roughen, blur, shadow): a file in `lib/design/fx/` exporting an `FxDef`
    (params with ranges; `shape` to reshape the outline or `filter` for an SVG filter), listed in `FX`. Sliders, validation,
    the toolbar and solids pick it up.
  - *A rail tool* (a new kind of drag on the sheet): the pattern above.
  `lib/design/tools.test.ts` runs every action and effect on a page with one of everything; new entries are covered.
- **Adding a small menu next to a panel (a hot bar, pips, a picker):** don't squeeze it inside the panel. Wrap the panel in `Docked` (`workbench/ui/AuxDock.tsx`) and give it an `AuxBar` of `AuxButton`s: it floats just outside the panel's edge (left/right/top/bottom) and moves with it. In use: the minimap's layer pips (left), the Shapes tool's favorites (right of the tool menu), the selection bar (left of the properties box).
- **Adding a box under the minimap:** a `PanelToggle` in the canvas's `panels` and its contents in `below` (one box open at a time).
- **Adding a file type on disk:** an API route (validate, mtime check, write + rename) + a watch route (`watchFolder`) + a hook or sync module that follows it over SSE.
- **Adding a library component:** a recipe in `lib/library/recipes/`, added to a set in `sets.ts`; dynamic parts name a behavior from `lib/library/behaviors`.

---

