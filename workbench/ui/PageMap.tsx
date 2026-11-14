"use client";

import { useMemo } from 'react';
import { PAPER, STATUS_COLOR } from './DesignArtboard';
import { pageSize, type Bible, type DesignPage } from '@/lib/design/types';
import { capsulePath, extrusion, lineControl, lineEnds, ellipsePath, polyPath, rotateTransform, smoothEllipse, zoneCorners, type VElement } from '@/lib/design/vector';
import { AssetDrawing, Erased, TraceImage } from './vector/shapes';
import type { TraceBox } from '@/workbench/hooks/useTrace';
import { drawOrder, layerOf, layersOf } from '@/lib/design/layers';

// Minimap of a design page. Elements are simplified by type rather than drawn tiny:
// shapes keep their color, text is a faint bar, images get an icon, vault assets draw themselves. Click or drag to move the view.

const THIN = { vectorEffect: 'non-scaling-stroke' as const, strokeWidth: 1 };
const BAR = '#8a8378';
const MAP_MAX_H = 260;   // px: a tall page's map gets narrower instead of pushing the boxes below it down

// A path at its own width (a thick rail stays thick) with a hairline over it (a thin one never vanishes)
function Wide({ d, color, width }: { d: string; color: string; width?: number }) {
  return (
    <>
      {!!width && width > 1 && <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={color} {...THIN} />
    </>
  );
}

function Mark({ el, all, bible }: { el: VElement; all: VElement[]; bible: Bible | null }) {
  switch (el.type) {
    case 'zone':
      return <polygon points={zoneCorners(el).map((p) => `${p.x},${p.y}`).join(' ')} fill={el.fill ?? 'none'} fillOpacity={0.8} stroke={el.stroke ?? (el.fill ? 'none' : BAR)} {...THIN} />;
    case 'rect': case 'ellipse': case 'capsule': case 'poly': {
      const paint = { fill: el.fill ?? 'none', fillOpacity: 0.6, stroke: el.stroke ?? (el.fill ? 'none' : BAR), ...THIN };
      if (el.type === 'poly' && el.open) return <Wide d={polyPath(el)} color={el.stroke ?? BAR} width={el.strokeWidth} />;   // a rail, a path
      const face = el.type === 'poly' ? <path d={polyPath(el)} {...paint} />
        : el.type === 'capsule' ? <path d={capsulePath(el, el.taper)} {...paint} />
        : el.type === 'ellipse' && !smoothEllipse(el) ? <path d={ellipsePath(el)} {...paint} />
        : el.type === 'rect' ? <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius} {...paint} />
        : <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} {...paint} />;
      const ex = extrusion(el);   // a solid: its sides, shaded, then its face raised
      return ex ? (
        <>
          <path d={ex.sides} {...paint} />
          {el.fill && <path d={ex.sides} fill="#000" fillOpacity={0.22} />}
          <g transform={`translate(${ex.up.x} ${ex.up.y})`}>{face}</g>
        </>
      ) : face;
    }
    case 'text': {
      const h = Math.min(el.h, (el.size ?? 24) * 1.2);
      return (
        <>
          {el.bg && <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.bgShape === 'pill' || el.bgShape === 'ellipse' ? el.h / 2 : el.bgShape === 'round' ? 8 : 0} fill={el.bg} fillOpacity={0.7} />}
          <rect x={el.x} y={el.y} width={el.w * 0.85} height={h} fill={el.color ?? BAR} opacity={0.35} />
        </>
      );
    }
    case 'line': {
      const [a, b] = lineEnds(el, all), c = lineControl(a, b, el.bend);   // a bent arrow stays bent
      return <Wide d={`M${a.x},${a.y} ${c ? `Q${c.x},${c.y} ` : 'L'}${b.x},${b.y}`} color={el.stroke ?? BAR} width={el.strokeWidth} />;
    }
    case 'stroke':
      return <Wide d={`M${el.points.map((p) => p.join(',')).join(' L')}`} color={el.color ?? BAR} width={el.width} />;
    case 'image': {
      const s = Math.min(el.w, el.h) * 0.5, cx = el.x + el.w / 2, cy = el.y + el.h / 2;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={BAR} fillOpacity={0.15} stroke={BAR} {...THIN} />
          <circle cx={cx + s * 0.25} cy={cy - s * 0.25} r={s * 0.12} fill={BAR} />
          <path d={`M${cx - s / 2},${cy + s * 0.35} L${cx - s * 0.12},${cy - s * 0.15} L${cx + s * 0.1},${cy + s * 0.1} L${cx + s * 0.25},${cy - s * 0.02} L${cx + s / 2},${cy + s * 0.35} Z`} fill={BAR} />
        </g>
      );
    }
    case 'asset': return <AssetDrawing el={el} />;   // its own drawing, so the map shows what's really there
    case 'status': {
      const r = (el.size ?? 20) / 2, status = bible?.topics.find((t) => t.id === el.topic)?.status ?? 'blank';
      return <circle cx={el.x + r} cy={el.y + r} r={r} fill={STATUS_COLOR[status]} />;
    }
  }
}

export function PageMap({ page, bible, view, onCenter, focus, trace, look }: {
  page: DesignPage | null;
  bible: Bible | null;
  view: { x: number; y: number; w: number; h: number };   // visible part of the page, in page units
  onCenter: (x: number, y: number) => void;
  focus?: string | null;   // a layer id: the other layers dim
  look?: { elements: VElement[]; transform: string } | null;   // the sheet's look-only view (a block from above): the map shows that too
  trace?: TraceBox | null;
}) {
  const { width: W, height: H } = pageSize(page);
  const marks = useMemo(() => {
    const els = look?.elements ?? page?.elements ?? [], layers = layersOf(page);
    const dimming = !!focus && layers.some((l) => l.id === focus);
    return drawOrder(els, layers).map((el) => (
      <g key={el.id} transform={rotateTransform(el, els)} opacity={(dimming && layerOf(layers, el).id !== focus ? 0.18 : 1) * (el.opacity ?? 1)}>
        <Erased el={el} all={els}><Mark el={el} all={els} bible={bible} /></Erased>
      </g>
    ));
  }, [page, bible, focus, look]);

  const center = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onCenter(((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height);
  };
  const showsAll = view.x <= 0 && view.y <= 0 && view.x + view.w >= W && view.y + view.h >= H;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} className="block mx-auto rounded-lg cursor-pointer"
      style={{ aspectRatio: `${W} / ${H}`, width: `min(100%, ${Math.round((MAP_MAX_H * W) / H)}px)` }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); center(e); }}
      onPointerMove={(e) => { if (e.buttons === 1) center(e); }}
    >
      <rect width={W} height={H} fill={page?.background ?? PAPER} />
      {trace && <TraceImage t={trace} />}
      <g pointerEvents="none" transform={look?.transform}>{marks}</g>
      {!showsAll && (
        <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="#6366f1" fillOpacity={0.12} stroke="#6366f1" vectorEffect="non-scaling-stroke" strokeWidth={1.5} pointerEvents="none" />
      )}
    </svg>
  );
}
