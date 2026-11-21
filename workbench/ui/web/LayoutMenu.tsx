"use client";

import { ArrowUpFromLine, Copy, Eye, EyeOff, Group, RotateCcw, ScrollText, SquareDashed, Trash2, Ungroup } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import {
  GROUP, componentOf, duplicateBlock, isGroup, isOverridden, moveOutOfGroup, parentOf, resolvePlacement, ungroupBlock, wrapInGroup,
  type PagePlacement,
} from '@/lib/project';
import { TIERS, type Tier } from '@/lib/devices';
import type { ProjectComponent } from '@/lib/library';
import { MENU_KEY as KEY, MENU_ROW as ROW, MenuRule, PopMenu } from '@/workbench/ui/PopMenu';

// The Layout layer's right-click menu: what can be done to the block under the pointer, or, on empty grid, what can be
// placed there. The block edits are pure ops in lib/project.ts, each applied as one store update; the keys
// (WebCanvas) run the same ones through useBlockActions.

export interface LayoutMenuAt { x: number; y: number; id: string | null }

export function useBlockActions({ pid, path, placements, tier, select }: {
  pid: string; path: string; placements: PagePlacement[]; tier: Tier; select: (id: string | null) => void;
}) {
  const setPlacements = useWorkbenchStore((s) => s.setPlacements);
  const setGeom = useWorkbenchStore((s) => s.setPlacementGeom);
  const resetTier = useWorkbenchStore((s) => s.resetPlacementTier);
  const setInstance = useWorkbenchStore((s) => s.setPlacementInstance);
  const removePlacement = useWorkbenchStore((s) => s.removePlacement);
  const find = (id: string) => placements.find((p) => p.id === id);
  return {
    duplicate: (id: string) => { const r = duplicateBlock(placements, id, tier); setPlacements(pid, path, r.placements); select(r.id); },
    wrap: (id: string) => { if (find(id)?.pin) return; const r = wrapInGroup(placements, id); setPlacements(pid, path, r.placements); select(r.id); },
    ungroup: (id: string) => { const p = find(id); if (p && isGroup(p)) { setPlacements(pid, path, ungroupBlock(placements, id, tier)); select(null); } },
    moveOut: (id: string) => { setPlacements(pid, path, moveOutOfGroup(placements, id, tier)); select(id); },
    toggleHidden: (id: string) => { const p = find(id); if (p) setGeom(pid, path, id, tier, { hidden: !resolvePlacement(p, tier).hidden }); },
    inherit: (id: string) => { if (tier !== 'mobile') resetTier(pid, path, id, tier); },
    inheritAll: () => { if (tier !== 'mobile') resetTier(pid, path, null, tier); },
    toggleBounded: (id: string) => { const p = find(id); if (p) setInstance(pid, path, id, { bounded: !p.bounded }); },
    remove: (id: string) => { removePlacement(pid, path, id); select(null); },
  };
}

export function LayoutMenu({ at, placements, tier, components, actions, placeHere, close }: {
  at: LayoutMenuAt; placements: PagePlacement[]; tier: Tier; components: Record<string, ProjectComponent> | undefined;
  actions: ReturnType<typeof useBlockActions>;
  placeHere: (componentId: string) => void;   // a component id, or GROUP
  close: () => void;
}) {
  const run = (f: () => void) => () => { f(); close(); };
  const tierLabel = TIERS.find((t) => t.id === tier)!.label;
  const p = at.id ? placements.find((x) => x.id === at.id) : undefined;

  if (!p) {   // empty grid: place something here
    const own = tier !== 'mobile' && placements.some((x) => x.at?.[tier]);
    return (
      <PopMenu x={at.x} y={at.y} close={close}>
        <div className="px-2.5 pt-1 pb-1.5 text-[9px] uppercase tracking-widest text-amber-500">Place here</div>
        <button className={ROW} title="A box with its own grid, to split this part of the page finer" onClick={run(() => placeHere(GROUP))}>
          <SquareDashed size={14} />Group
        </button>
        <div className="max-h-[240px] overflow-y-auto">
          {Object.values(components ?? {}).map((c) => (
            <button key={c.id} className={ROW} onClick={run(() => placeHere(c.id))}>
              <span className="w-[14px]" />{c.recipe.name}<span className={KEY}>{c.recipe.category}</span>
            </button>
          ))}
        </div>
        {own && (
          <>
            <MenuRule />
            <button className={ROW} title={`Every block placed its own way on ${tierLabel} follows the smaller sizes again`} onClick={run(actions.inheritAll)}>
              <RotateCcw size={14} />Inherit all on {tierLabel}
            </button>
          </>
        )}
      </PopMenu>
    );
  }

  const g = resolvePlacement(p, tier), group = isGroup(p), inGroup = !!parentOf(placements, p);
  const name = p.name ?? (group ? 'Group' : componentOf(components, p)?.recipe.name) ?? 'Block';
  return (
    <PopMenu x={at.x} y={at.y} close={close}>
      <div className="px-2.5 pt-1 pb-1.5 text-[9px] uppercase tracking-widest text-amber-500 truncate max-w-[220px]">{name}</div>
      <button className={ROW} title={group ? 'A copy of the group and everything in it, just under it' : 'A copy just under it'} onClick={run(() => actions.duplicate(p.id))}>
        <Copy size={14} />Duplicate<span className={KEY}>Ctrl D</span>
      </button>
      {!p.pin && (
        <button className={ROW} title="Put it in a new group that takes its place on every device" onClick={run(() => actions.wrap(p.id))}>
          <Group size={14} />Wrap in group<span className={KEY}>Ctrl G</span>
        </button>
      )}
      {group && (
        <button className={ROW} title="Its blocks go to where the group sits, each where it showed; the group goes" onClick={run(() => actions.ungroup(p.id))}>
          <Ungroup size={14} />Ungroup<span className={KEY}>Ctrl ⇧ G</span>
        </button>
      )}
      {inGroup && (
        <button className={ROW} title="Out to where its group sits, where it showed" onClick={run(() => actions.moveOut(p.id))}>
          <ArrowUpFromLine size={14} />Move out of group
        </button>
      )}
      <MenuRule />
      <button className={ROW} onClick={run(() => actions.toggleHidden(p.id))}>
        {g.hidden ? <Eye size={14} /> : <EyeOff size={14} />}{g.hidden ? `Show on ${tierLabel}` : `Hide on ${tierLabel}`}
      </button>
      {tier !== 'mobile' && isOverridden(p, tier) && (
        <button className={ROW} title={`Drop what was set on ${tierLabel}: it follows the smaller sizes again`} onClick={run(() => actions.inherit(p.id))}>
          <RotateCcw size={14} />Inherit on {tierLabel}
        </button>
      )}
      {!p.pin && (
        <button className={ROW} title="Scrolls inside itself, never taller than the screen between the pinned edges" onClick={run(() => actions.toggleBounded(p.id))}>
          <ScrollText size={14} />Scrolls inside{p.bounded && <span className={KEY}>on</span>}
        </button>
      )}
      <MenuRule />
      <button className={`${ROW} text-red-300`} title={group ? 'The group and everything in it' : undefined} onClick={run(() => actions.remove(p.id))}>
        <Trash2 size={14} />Delete<span className={KEY}>Del</span>
      </button>
    </PopMenu>
  );
}
