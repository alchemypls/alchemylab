"use client";

import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useWorkbenchStore } from '@/lib/store';
import { SCENE_GRID, SCENES, getSlideDir } from '@/lib/scenes';
import { VaultButton } from './VaultButton';

const SLOT_ID = { panel: 'canvas-panel-slot', below: 'canvas-panel-below' };

// Top-right panel, above every canvas: canvas switcher, the active canvas's own controls, vault.
// Below it is room for one more box, such as a properties panel, that scrolls if it's tall.
export function CanvasPanel() {
  const activeScene    = useWorkbenchStore((s) => s.activeScene);
  const setActiveScene = useWorkbenchStore((s) => s.setActiveScene);
  const active = SCENES.find((s) => s.id === activeScene);

  return (
    <div className="absolute top-[15px] right-[15px] bottom-[15px] z-40 w-[294px] flex flex-col gap-2 pointer-events-none">
    <div className="shrink-0 bg-neutral-900/80 border border-neutral-700/60 rounded-xl p-1.5 flex flex-col gap-1.5 backdrop-blur-sm pointer-events-auto">
      <div className="flex items-center gap-2 px-0.5">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${SCENE_GRID[0].length}, 1fr)` }}>
          {SCENE_GRID.flat().map((id) => (
            <button
              key={id}
              onClick={() => setActiveScene(id, getSlideDir(activeScene, id))}
              title={SCENES.find((s) => s.id === id)?.label}
              aria-label={SCENES.find((s) => s.id === id)?.label}
              className={`w-[9px] h-[9px] rounded-[2px] transition-all ${
                id === activeScene
                  ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
                  : 'bg-neutral-700 hover:bg-neutral-500'
              }`}
            />
          ))}
        </div>
        <div className="min-w-0 text-[10px] tracking-[0.2em] text-neutral-200 uppercase leading-tight" title={active?.description}>{active?.label}</div>
      </div>
      <div id={SLOT_ID.panel} className="flex flex-col gap-1.5 empty:hidden" />
      <VaultButton />
    </div>
    <div id={SLOT_ID.below} className="flex-1 min-h-0" />
    </div>
  );
}

// A canvas puts its own controls in the panel with this. A portal keeps the canvas's
// React context, so a minimap still reads its ReactFlow while sitting outside it.
export function CanvasPanelSlot({ children, area = 'panel' }: { children: ReactNode; area?: keyof typeof SLOT_ID }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setSlot(document.getElementById(SLOT_ID[area])), [area]);
  return slot ? createPortal(children, slot) : null;
}
