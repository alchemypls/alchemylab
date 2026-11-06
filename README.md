# Alchemy

A spatial UI design workbench for authoring button manifests and previewing live components on an infinite canvas.

## What it does

You describe a button using a structured **manifest** — shape, colors, shadows, typography, spring physics for hover/press — and the workbench renders the live component alongside editors for every property. Everything lives on a pannable, zoomable whiteboard where tools float as draggable, resizable widget nodes connected by wires.

## Stack

- **Next.js 14** (App Router)
- **@xyflow/react** — infinite canvas, custom nodes and edges
- **Zustand** — all state (manifest data + canvas layout)
- **Framer Motion** — live button preview animations
- **Tailwind CSS**
- **TypeScript**

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The canvas loads with a sample manifest already wired up.

## Canvas controls

| Action | How |
|---|---|
| Pan | Middle-click drag, right-click drag, or WASD |
| Zoom | Scroll wheel |
| Select | Left-click drag on empty canvas |
| Move widget | Drag the title bar |
| Resize widget | Drag the edge/corner handles |
| Reposition wire elbow | Drag the gear dot on the wire |
| Reattach wire source | Select wire → drag the source dot |

## Project structure

```
lib/schema/     — ButtonManifest type system (Structural / Visual / Intent layers)
lib/generator/  — generateFramerButton(): emits ready-to-use TSX from a manifest
lib/store.ts    — Zustand store (manifests + React Flow nodes/edges)
workbench/      — canvas widgets, edges, and shell UI
app/page.tsx    — full-screen ReactFlow root
```

## Manifest model

A manifest has three layers:

- **Structural** — shape, diameter, label, z-depth
- **Visual** — background color, shadow, typography, backdrop blur, shader ref
- **Intent** — hover and press behaviors stored as spring/tween physics, not keyframes

Plus a **variants block** (idle / hover / pressed) that the generator expands into Framer Motion variant objects.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # ESLint
```
