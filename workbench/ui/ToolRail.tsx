"use client";

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eraser } from 'lucide-react';

// The tool rail on the left of the full-screen canvases. One master list in one order: each canvas or
// editor shows a subset, and a tool keeps its place relative to the others as the rail grows and shrinks.

export type ToolKey = 'browse' | 'options' | 'select' | 'shape' | 'text' | 'zone' | 'tile' | 'wall' | 'roof' | 'asset' | 'pen' | 'erase' | 'read';
export interface RailTool { key: ToolKey; hotkey: string; icon: ReactNode; label: string }

const ALL_TOOLS: RailTool[] = [
  { key: 'browse',  hotkey: 'b', icon: '▤', label: 'Browse' },
  { key: 'options', hotkey: 'o', icon: '☰', label: 'Preview options' },
  { key: 'select',  hotkey: 'v', icon: '↖', label: 'Select' },
  { key: 'shape',   hotkey: 's', icon: '▭', label: 'Shapes' },
  { key: 'text',    hotkey: 't', icon: 'T', label: 'Text' },
  { key: 'zone',    hotkey: 'z', icon: '◇', label: 'Floor zone' },
  { key: 'tile',    hotkey: 'f', icon: '▱', label: 'Floors: drag over tiles' },
  { key: 'wall',    hotkey: 'w', icon: '▮', label: 'Walls: drag along grid lines (Shift: a room)' },
  { key: 'roof',    hotkey: 'r', icon: '⌂', label: 'Roofs: click a room, or drag a box' },
  { key: 'asset',   hotkey: 'x', icon: '◈', label: 'Place from vault' },
  { key: 'pen',     hotkey: 'p', icon: '✎', label: 'Pen' },
  { key: 'erase',   hotkey: 'e', icon: <Eraser size={15} strokeWidth={1.8} className="inline-block align-[-2px]" />, label: 'Eraser' },
  { key: 'read',    hotkey: 'h', icon: '✋', label: 'Read and pan' },
];
export const toolsFor = (keys: ToolKey[]) => ALL_TOOLS.filter((t) => keys.includes(t.key));

const RAIL_TOP = 76, RAIL_PAD = 6, RAIL_STEP = 36;   // where each tool's button sits, so its menu can open beside it
export const menuTop = (tools: RailTool[], tool: ToolKey) => RAIL_TOP + RAIL_PAD + Math.max(tools.findIndex((t) => t.key === tool), 0) * RAIL_STEP;

export const RAIL_BUTTON = 'w-8 h-8 rounded-lg text-sm';

export function ToolRail({ tools, tool, pick, icon, children }: {
  tools: RailTool[]; tool: ToolKey; pick: (t: ToolKey) => void;
  icon?: (t: RailTool) => ReactNode;   // for a tool whose icon shows its state
  children?: ReactNode;                // extra buttons after the tools
}) {
  return (
    <div className="absolute left-[15px] top-[76px] z-30 w-10 bg-neutral-900/90 border border-neutral-700/60 rounded-xl flex flex-col items-center py-1.5 backdrop-blur-sm">
      <AnimatePresence initial={false}>
        {tools.map((t) => (
          <motion.button
            key={t.key} title={`${t.label} (${t.hotkey.toUpperCase()})`} aria-label={t.label} onClick={() => pick(t.key)}
            initial={{ height: 0, opacity: 0, marginBottom: 0 }} animate={{ height: 32, opacity: 1, marginBottom: 4 }} exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.16 }}
            className={`w-8 rounded-lg text-sm overflow-hidden ${tool === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400 hover:bg-neutral-800'}`}
          >
            <span className="relative">{icon?.(t) ?? t.icon}</span>
          </motion.button>
        ))}
      </AnimatePresence>
      {children}
    </div>
  );
}
