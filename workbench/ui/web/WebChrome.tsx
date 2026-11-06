"use client";

// The Web canvas's own panel and sheet parts: the minimap, the layer pips, the column bands, the see-through icon.

import type { useSheetView } from '@/workbench/hooks/useSheetView';
import { MAP_RAIL } from '@/workbench/ui/SheetPanel';
import { ROW_HEIGHT } from '@/lib/project';
import type { VElement } from '@/lib/design/vector';
import { WEB_LAYERS, type Placed, type WebLayer } from './WebLayers';

export const PAPER = '#f4efe6';

// Pixel shades for the see-through toggle: a frame bar with a temple, two lenses tapering down, shine pixels left
// as holes. Drawn in currentColor, so it lights up with the toggle.
const SHADES = (() => {
  const px: [number, number][] = [], shine = new Set(['2,1', '4,1', '3,2', '5,2', '4,3']);
  for (let x = 0; x < 23; x++) px.push([x, 0]);
  px.push([23, 1]);
  const lens = (o: number) => [[1, 9], [1, 9], [2, 8], [3, 7]].forEach(([a, b], i) => {
    for (let x = a; x <= b; x++) if (!shine.has(`${x},${i + 1}`)) px.push([x + o, i + 1]);
  });
  lens(0); lens(11);
  return px;
})();
export function ShadesIcon() {
  return (
    <svg viewBox="0 0 24 5" width={30} height={7} shapeRendering="crispEdges" className="block my-0.5" aria-hidden>
      {SHADES.map(([x, y]) => <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />)}
    </svg>
  );
}

// The tier's column grid under the layout, as faint bands
export function Columns({ cols, width }: { cols: number; width: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex">
      {Array.from({ length: cols }, (_, i) => <div key={i} style={{ width }} className={i % 2 ? '' : 'bg-indigo-500/[0.06]'} />)}
    </div>
  );
}

// The page small: wireframe outlines, layout blocks, the visible part. Click or drag to move the view.
export function WebMap({ width: W, height: H, wire, k, placed, colWidth, sv, layer }: {
  width: number; height: number; wire: VElement[] | undefined; k: number; placed: Placed[]; colWidth: number;
  sv: ReturnType<typeof useSheetView>; layer: WebLayer;
}) {
  const center = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    sv.centerOn(((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height);
  };
  const v = sv.visible, showsAll = v.x <= 0 && v.y <= 0 && v.x + v.w >= W && v.y + v.h >= H;
  const thin = { strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const };
  return (
      <div className="flex justify-center bg-neutral-950/60 rounded-lg" style={{ height: 180 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`} className="h-full cursor-pointer" style={{ aspectRatio: `${W} / ${H}`, maxWidth: '100%' }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); center(e); }}
          onPointerMove={(e) => { if (e.buttons === 1) center(e); }}
        >
          <rect width={W} height={H} fill={PAPER} />
          {wire && (
            <g transform={`scale(${k})`} opacity={layer === 'wireframe' ? 0.9 : 0.35} fill="none" stroke="#1f1b16">
              {wire.map((el) =>
                el.type === 'stroke' ? <polyline key={el.id} points={el.points.map((p) => p.join(',')).join(' ')} {...thin} />
                : 'w' in el && 'x' in el ? <rect key={el.id} x={el.x} y={el.y} width={el.w} height={el.h} {...thin} />
                : null)}
            </g>
          )}
          {layer !== 'wireframe' && placed.map(({ p, g }) => (
            <rect key={p.id} x={g.col * colWidth + 4} y={g.row * ROW_HEIGHT + 4} width={g.colSpan * colWidth - 8} height={g.rowSpan * ROW_HEIGHT - 8} rx={6} fill={p.color ?? '#818cf8'} fillOpacity={0.45} />
          ))}
          {!showsAll && <rect x={v.x} y={v.y} width={v.w} height={v.h} fill="#6366f1" fillOpacity={0.12} stroke="#6366f1" vectorEffect="non-scaling-stroke" strokeWidth={1.5} />}
        </svg>
      </div>
  );
}

// Left of the minimap: the layers, top one first (1, 2, 3, Ctrl + wheel)
export function WebLayerPips({ layer, setLayer }: { layer: WebLayer; setLayer: (l: WebLayer) => void }) {
  return (
    <div className={MAP_RAIL}>
      {WEB_LAYERS.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
        <button key={l.id} className="group p-1" aria-pressed={layer === l.id} aria-label={l.label} title={`${l.label} (${i + 1}, Ctrl + wheel): ${l.hint}`} onClick={() => setLayer(l.id)}>
          <span className={`block w-2 h-2 rounded-full transition-colors ${layer === l.id ? 'bg-amber-400' : 'bg-neutral-500 group-hover:bg-neutral-300'}`} />
        </button>
      ))}
    </div>
  );
}
