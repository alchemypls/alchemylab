"use client";

import type { CSSProperties, ReactNode } from 'react';

// Auxiliary bars: small menus that float just outside a panel's edge instead of taking room inside it (the minimap's
// layer pips, the Shapes tool's shape picker). Wrap the panel in Docked and hand it the bar; the bar rides along with
// the panel wherever it moves. The panel keeps its own scrolling: Docked itself never clips, so the bar can't be cut off.
//
//   <Docked side="right" aux={<AuxBar>{…AuxButton…}</AuxBar>}>{the panel}</Docked>

export type AuxSide = 'left' | 'right' | 'top' | 'bottom';
export type AuxAlign = 'start' | 'center' | 'end';

const PLACE: Record<AuxSide, string> = { left: 'right-full', right: 'left-full', top: 'bottom-full', bottom: 'top-full' };
const ALONG: Record<'v' | 'h', Record<AuxAlign, string>> = {
  v: { start: 'top-0', center: 'top-1/2 -translate-y-1/2', end: 'bottom-0' },    // a bar left or right: aligned down the edge
  h: { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' },   // a bar above or below: aligned across it
};

export function Docked({ aux, side = 'right', align = 'start', gap = 6, className = '', style, children }: {
  aux?: ReactNode; side?: AuxSide; align?: AuxAlign;
  gap?: number;           // px between the panel's edge and the bar
  className?: string; style?: CSSProperties;   // the wrapper's: put the panel's own positioning (absolute, top…) here
  children: ReactNode;
}) {
  const margin = { left: { marginRight: gap }, right: { marginLeft: gap }, top: { marginBottom: gap }, bottom: { marginTop: gap } }[side];
  // The bar is placed against this wrapper, so it needs a position; one the panel already has (absolute, fixed) wins,
  // because with both classes Tailwind's later `relative` would override it and stretch the wrapper full width
  const positioned = /(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className);
  return (
    <div className={`${positioned ? '' : 'relative '}${className}`} style={style}>
      {children}
      {aux && <div className={`absolute ${PLACE[side]} ${ALONG[side === 'left' || side === 'right' ? 'v' : 'h'][align]} pointer-events-auto`} style={margin}>{aux}</div>}
    </div>
  );
}

// The bar's shell: a pill, vertical by default, in the panels' colors
export const AUX_BAR = 'flex items-center gap-0.5 p-1 rounded-full bg-neutral-900/95 border border-neutral-700/60 backdrop-blur-sm shadow-lg shadow-black/30';
export function AuxBar({ dir = 'v', className = '', children }: { dir?: 'v' | 'h'; className?: string; children: ReactNode }) {
  return <div className={`${AUX_BAR} ${dir === 'v' ? 'flex-col' : 'flex-row'} ${className}`}>{children}</div>;
}

// One square button on a bar: lit when on
export function AuxButton({ on, title, onClick, children }: { on?: boolean; title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title} aria-label={title} aria-pressed={on} onClick={onClick}
      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors ${on ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
    >{children}</button>
  );
}
