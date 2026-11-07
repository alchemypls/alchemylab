# Alchemy

[![CI](https://github.com/alchemypls/alchemylab/actions/workflows/ci.yml/badge.svg)](https://github.com/alchemypls/alchemylab/actions/workflows/ci.yml)

A design-to-build workbench. Four full-screen canvases, one job each, on a 2×2 grid:

| | |
|---|---|
| **Ideation**: design bible pages, drawn as vector one-pagers | **Fab**: makes the pieces the other canvases use (visual identity, components, game blocks) |
| **Live**: the web project running for real, in a device frame, with console and checks | **Web**: page and app layouts in three layers (wireframe → layout → preview) |

Alt + WASD (or the arrow keys) moves between canvases.

Everything is a file on disk that the canvases and the agent (Claude Code) both read and write: design bibles in `design/`,
vector assets and palettes in `vault/`, web projects in `projects/`. Edits made in one place show up live everywhere else.
Web projects export as plain HTML/CSS or a Next.js page. The workbench is built with React and Tailwind, but its output uses neither.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Alchemy is a local tool: it reads and writes files in this folder and has no login, so it only answers the computer
it runs on. To try a Live page on your phone, use **Share on this Wi-Fi** in the Live canvas's phone box: phones can view
pages, never edit them, and sharing turns itself off after 30 minutes. Don't deploy it to a server.

## Controls

| Action | How |
|---|---|
| Switch canvas | Alt + WASD / arrows |
| Pan | Space + drag, or middle-drag |
| Zoom | Mouse wheel (trackpad pinch) |
| Fit / 100% | Ctrl + 0 / Ctrl + 1 |
| Tools | V select · S shapes · T text · P pen · E eraser · Z floor zone · X place from vault · H read and pan |
| Tool settings | Click the tool in the rail again |
| Grid | G |
| Undo / redo | Ctrl + Z / Ctrl + Shift + Z |
| Duplicate / delete | Ctrl + D / Del |
| Nudge | Arrows (Shift: ×5) |
| Layers | 1 / 2 / 3, Ctrl + wheel, or the pips beside the minimap |

## Commands

```bash
npm run dev            # dev server on :3000
npm run build          # production build
npm run lint           # ESLint
npm test               # unit tests (Vitest): geometry, layout, validation, export, and every content file
npm run design:check   # validate design bibles and report page fit
npm run parts:build    # vault parts written as code (scripts/parts) → vault/assets
npm run asset:render   # PNGs of vault assets in .render/ (needs inkscape + ImageMagick)
npm run asset:info     # vault assets summarized in inches
npm run page:render    # a bible page as an image, through the real artboard
```

## Stack

Next.js 14 (App Router) · React · Zustand · Framer Motion · Tailwind CSS · TypeScript (strict)

## Layout

```
app/        — the root page, API routes for design/, vault/, projects/ (validated writes, mtime conflicts, SSE watches), /live
lib/        — pure logic: design pages and vector geometry, vault, layers, the component library, the page generator, store
workbench/  — canvases, hooks, shared UI (vector tools, sheet shell, panels)
scripts/    — parts build, renders, checks, the pen bridge (USB tablet or reMarkable)
design/ vault/ projects/  — content on disk
```

See `CLAUDE.md` for the full guide.
