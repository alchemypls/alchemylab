"use client";

// What a vector sheet draws over the page while editing: crowded tiles, footprints, the selection and its handles,
// and the preview of the gesture in progress. None of it is part of the page.

import { boundsOf, capsulePath, crowdedTiles, lineEnds, offPlane, onPlane, planeOf, PLANES, rotateTransform, standing, zoneCorners, zonePoint, type FootingOf, type VElement, type VZone } from '@/lib/design/vector';
import { strokeFields, type ToolStyles } from '@/lib/design/toolStyles';
import { ACCENT, INK, SANS } from '../DesignArtboard';
import { boxFrom, DIRS, down, toPoints, zoneSpan, type Gesture } from './gesture';
import { Ink } from './shapes';

// Floor tiles two vault pieces stand on, in red
export function Crowded({ els, fpOf, line }: { els: VElement[]; fpOf: FootingOf; line: number }) {
  return (
    <g pointerEvents="none">
      {crowdedTiles(els, fpOf).map(({ zone: z, a, b }) => (
        <polygon
          key={`${z.id}:${a}:${b}`} points={toPoints([zonePoint(z, a, b), zonePoint(z, a + 1, b), zonePoint(z, a + 1, b + 1), zonePoint(z, a, b + 1)])}
          fill="#dc2626" fillOpacity={0.28} stroke="#dc2626" strokeWidth={line} strokeLinejoin="round"
        ><title>Two pieces stand on this tile</title></polygon>
      ))}
    </g>
  );
}

// The floor tiles each selected piece covers
export function Footprints({ els, selected, fpOf, line }: { els: VElement[]; selected: string[]; fpOf: FootingOf; line: number }) {
  return (
    <g pointerEvents="none">
      {els.filter((x) => selected.includes(x.id)).map((el) => {
        const s = standing(els, el, fpOf);
        if (!s) return null;
        const { zone: z, a, b, cols, rows } = s;
        const corners = [zonePoint(z, a, b), zonePoint(z, a + cols, b), zonePoint(z, a + cols, b + rows), zonePoint(z, a, b + rows)];
        return <polygon key={el.id} points={toPoints(corners)} fill={ACCENT} fillOpacity={0.18} stroke={ACCENT} strokeWidth={line * 1.5} strokeLinejoin="round" />;
      })}
    </g>
  );
}

export function Selection({ els, selected, single, knobOnly, handle, line }: { els: VElement[]; selected: string[]; single?: VElement; knobOnly?: boolean; handle: number; line: number }) {
  const picked = els.filter((x) => selected.includes(x.id));
  return (
    <g pointerEvents="none">
      {picked.map((el) => {
        if (el.type === 'zone') return <polygon key={el.id} points={toPoints(zoneCorners(el))} fill="none" stroke={ACCENT} strokeWidth={line * 2} strokeDasharray={`${line * 4} ${line * 3}`} />;
        const b = boundsOf(el, els);
        return <rect key={el.id} x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} transform={rotateTransform(el, els)} fill="none" stroke={ACCENT} strokeWidth={line} strokeDasharray={`${line * 4} ${line * 3}`} />;
      })}
      {single?.type === 'line' && lineEnds(single, els).map((p, i) => (
        <circle key={i} data-handle={i ? 'to' : 'from'} cx={p.x} cy={p.y} r={handle / 1.5} fill="#fff" stroke={ACCENT} strokeWidth={line} pointerEvents="all" style={{ cursor: 'move' }} />
      ))}
      {single?.type === 'zone' && DIRS.map((d) => {
        const p = zonePoint(single, d.includes('w') ? 0 : d.includes('e') ? single.cols : single.cols / 2, d.includes('n') ? 0 : d.includes('s') ? single.rows : single.rows / 2);
        return <rect key={d} data-handle={d} x={p.x - handle / 2} y={p.y - handle / 2} width={handle} height={handle} fill="#fff" stroke={ACCENT} strokeWidth={line} pointerEvents="all" style={{ cursor: 'grab' }} />;
      })}
      {single && (single.type === 'rect' || single.type === 'ellipse' || single.type === 'capsule' || single.type === 'poly' || single.type === 'text' || single.type === 'image' || single.type === 'asset') && (() => {
        const b = boundsOf(single, els), knob = { x: b.x + b.w / 2, y: b.y - handle * 3 };
        return (
          <g transform={rotateTransform(single, els)}>
            {!knobOnly && DIRS.map((d) => {
              const x = d.includes('w') ? b.x : d.includes('e') ? b.x + b.w : b.x + b.w / 2;
              const y = d.includes('n') ? b.y : d.includes('s') ? b.y + b.h : b.y + b.h / 2;
              return <rect key={d} data-handle={d} x={x - handle / 2} y={y - handle / 2} width={handle} height={handle} fill="#fff" stroke={ACCENT} strokeWidth={line} pointerEvents="all" style={{ cursor: `${d}-resize` }} />;
            })}
            {!planeOf(single) && <line x1={knob.x} y1={b.y - handle / 2} x2={knob.x} y2={knob.y} stroke={ACCENT} strokeWidth={line} />}
            {!planeOf(single) && <circle data-handle="rotate" cx={knob.x} cy={knob.y} r={handle / 1.6} fill="#fff" stroke={ACCENT} strokeWidth={line} pointerEvents="all" style={{ cursor: 'grab' }}><title>{knobOnly ? 'Turn (on an isometric floor, by quarter turns; flat: any angle, Shift for 15° steps)' : 'Rotate (Shift: 15° steps)'}</title></circle>}
          </g>
        );
      })()}
    </g>
  );
}

export function Preview({ g, line, pen }: { g: Gesture; line: number; pen?: ToolStyles['pen'] }) {
  const common = { fill: 'none', stroke: ACCENT, strokeWidth: line * 1.5, pointerEvents: 'none' as const };
  if (g.kind === 'cut') {   // the line eraser: the line, and the band it would rub out
    const up = (q: { x: number; y: number }) => ({ x: q.x + g.off.x, y: q.y + g.off.y });
    return (
      <g pointerEvents="none">
        {(g.off.x !== 0 || g.off.y !== 0) && <polygon points={toPoints([g.a, g.b, up(g.b), up(g.a)])} fill="#dc2626" fillOpacity={0.18} stroke="#dc2626" strokeWidth={line} strokeDasharray={`${line * 4} ${line * 3}`} />}
        <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke="#dc2626" strokeWidth={line * 2} strokeLinecap="round" />
        {g.placed && [g.a, g.b].map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={line * 3.5} fill="#fff" stroke="#dc2626" strokeWidth={line * 1.5} />)}
      </g>
    );
  }
  if (g.kind === 'zone') {
    const span = zoneSpan(g.grid, g.start, g.cur);
    const z: VZone = { id: '', type: 'zone', ...span };
    const c = zonePoint(z, span.cols / 2, span.rows / 2);
    return (
      <g pointerEvents="none">
        <polygon points={toPoints(zoneCorners(z))} fill={ACCENT} fillOpacity={0.25} stroke={ACCENT} strokeWidth={line * 1.5} />
        <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontFamily={SANS} fontSize={13 * line / 1.5} fontWeight={700} fill={INK}>{span.cols} × {span.rows}</text>
      </g>
    );
  }
  if (g.kind === 'create' && g.plane) {
    const m = PLANES[g.plane], up = g.lift ?? 0, s0 = down(g.start, up), b = boxFrom(s0, offPlane(m, s0, down(g.cur, up)));
    return <polygon points={toPoints([{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }].map((c) => { const q = onPlane(m, s0, c); return { x: q.x, y: q.y - up }; }))} {...common} />;
  }
  if (g.kind === 'marquee' || g.kind === 'create') {
    const b = boxFrom(g.start, g.cur);
    if (g.kind === 'create' && g.type === 'capsule') return <path d={capsulePath(b, 0.6)} {...common} />;
    if (g.kind === 'create' && g.type === 'ellipse') return <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} {...common} />;
    return <rect x={b.x} y={b.y} width={b.w} height={b.h} {...common} strokeDasharray={g.kind === 'marquee' ? `${line * 4} ${line * 3}` : undefined} />;
  }
  if (g.kind === 'poly') {
    const pts = [...g.pts, g.cur];
    return (
      <g pointerEvents="none">
        <polyline points={toPoints(pts)} {...common} strokeLinejoin="round" />
        {g.pts.length >= 2 && <line x1={g.cur.x} y1={g.cur.y} x2={g.pts[0].x} y2={g.pts[0].y} {...common} strokeDasharray={`${line * 4} ${line * 3}`} strokeOpacity={0.6} />}
        <circle cx={g.pts[0].x} cy={g.pts[0].y} r={line * 4} fill="#fff" stroke={ACCENT} strokeWidth={line} />
      </g>
    );
  }
  if (g.kind === 'line') return <line x1={g.start.x} y1={g.start.y} x2={g.cur.x} y2={g.cur.y} {...common} />;
  if (g.kind === 'pen') {
    const f = pen ? strokeFields(pen) : undefined;
    return <g pointerEvents="none" opacity={f?.opacity}><Ink el={{ points: g.points, pressures: g.pressures, ...f }} /></g>;
  }
  return null;
}
