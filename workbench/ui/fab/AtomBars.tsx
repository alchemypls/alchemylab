"use client";

import { useMemo, useState } from 'react';
import { layerOf, layersOf } from '@/lib/design/layers';
import { STRIP_SIZES, tileStrip } from '@/lib/design/strip';
import { wallStrip } from '@/lib/design/structure';
import type { VaultAsset } from '@/lib/design/vault';
import { AuxBar, AuxButton } from '@/workbench/ui/AuxDock';

// Blocks' bars for a floor, wall or roof atom, docked by the minimap: how much of its strip shows, and its states.

// The states' icons (an atom's layers, picked on the state bar): plan sketches of where each draws
const ico = (d: string, extra?: JSX.Element) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d && <path d={d} />}{extra}</svg>;
const STATE_ICON: Record<string, JSX.Element> = {
  faces: ico('M2 4 L8 7 L14 4 M2 4 V11 L8 14 L14 11 V4 M8 7 V14'),
  end: ico('M2 8 H10', <circle cx="12" cy="8" r="2" fill="currentColor" />),
  corner: ico('M4 2 V12 H14', <circle cx="4" cy="12" r="1.8" fill="currentColor" />),
  tee: ico('M2 5 H14 M8 5 V14', <circle cx="8" cy="5" r="1.8" fill="currentColor" />),
  cross: ico('M2 8 H14 M8 2 V14', <circle cx="8" cy="8" r="1.8" fill="currentColor" />),
  surface: ico('M8 3 L14 7 L8 11 L2 7 Z M5 5 L11 9 M11 5 L5 9'),
  eave: ico('M3 9 L8 4 L13 9', <path d="M1.5 11.5 H14.5" strokeWidth="2.6" />),
  ridge: ico('M2 12 L8 6 L14 12', <path d="M5.5 8.5 L8 6 L10.5 8.5" strokeWidth="2.8" />),
};
const STATE_TIP: Record<string, string> = {
  faces: 'Faces: the wall itself (draw on the left or right plane for that face)',
  end: 'End: where a wall stops', corner: 'Corner: two walls meeting at an angle', tee: 'Tee: three walls meeting', cross: 'Cross: four walls meeting',
  surface: 'Surface: the roof tile, laid on every slope', eave: 'Eave: the strip round the edge (its color)', ridge: 'Ridge: where slopes meet (not drawn on roofs yet)',
};

// An atom is drawn as one strip (lib/design/strip.ts): a wall's faces six tiles long, a floor's or roof's tile a 6 × 6
// patch. How much of it shows (1, 2, 3 or 6 tiles, drawn on in place) and what goes under and around the drawing for it.
// undefined: not an atom
export type AtomStrip = ReturnType<typeof useAtomStrip>;
export function useAtomStrip(atom: VaultAsset | undefined) {
  const [n, setN] = useState<number>(1);
  const part = atom?.part, ok = part === 'wall' || part === 'floor' || part === 'roof';
  const strip = useMemo(() => {
    if (!atom || !ok) return undefined;
    if (part === 'wall') return wallStrip(atom, n);
    const ls = layersOf(atom), id = part === 'roof' ? 'surface' : 'base';
    return tileStrip(atom, (atom.elements ?? []).filter((e) => { const l = layerOf(ls, e); return l.id === id && !l.hidden; }), n);
  }, [atom, ok, part, n]);
  return atom && strip ? { atom, n, setN, strip, wall: part === 'wall' } : undefined;
}

export function StripBar({ s }: { s: NonNullable<AtomStrip> }) {
  return (
    <AuxBar>{STRIP_SIZES.map((n) => (
      <AuxButton key={n} on={s.n === n} onClick={() => s.setN(n)} title={n === 1 ? 'The single tile' : s.wall ? `The wall ${n} tiles long: draw on any of them` : `${n} × ${n} tiles: draw on any of them`}>
        <span className="text-[11px] font-mono">{n}×</span>
      </AuxButton>
    ))}</AuxBar>
  );
}

// An atom's layers are its states (a wall's faces and joints, a roof's surface, eave, ridge), picked here in place of
// the layer pips. A floor has one, so nothing to pick (and no pips)
export function StateBar({ atom, layer, pick }: { atom: VaultAsset; layer?: string; pick: (id: string) => void }) {
  const ls = atom.layers ?? [];
  if (ls.length < 2) return <></>;
  return (
    <AuxBar>{ls.map((l) => (
      <AuxButton key={l.id} on={layer === l.id} onClick={() => pick(l.id)} title={STATE_TIP[l.id] ?? l.name}>
        {STATE_ICON[l.id] ?? <span className="text-[11px] font-mono">{l.name.slice(0, 1)}</span>}
      </AuxButton>
    ))}</AuxBar>
  );
}

// A wall's joint layers draw only where walls meet: said in the banner while drawing on one, or it looks lost
const JOINT_NOTE: Record<string, string> = { end: 'a free end', corner: 'a corner', tee: 'a tee (3 walls)', cross: 'a cross (4 walls)' };
export const jointNoteFor = (atom: VaultAsset, layer?: string) =>
  atom.part === 'wall' && layer && JOINT_NOTE[layer] ? `Drawing on the ${layer} joint: it shows only at ${JOINT_NOTE[layer]}. Pick Faces for the wall itself.` : null;
