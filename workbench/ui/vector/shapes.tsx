"use client";

// How each vector element draws, as SVG. Shared by VectorArtboard, the minimap, the vault thumbnails and the render scripts.

import { useId, type ReactNode } from 'react';
import { drawOrder, layersOf } from '@/lib/design/layers';
import { filterSteps } from '@/lib/design/fx';
import { useAssetUrl } from '@/lib/assets';
import { assetView, blockPose, projectedElements, tintElements, type VaultAsset } from '@/lib/design/vault';
import type { Bible, TopicStatus } from '@/lib/design/types';
import {
  capsulePath, dashProps, ellipsePath, extrusion, roofWalls, reshapedPath, reshapes, gridOf, lineControl, lineEnds, polyPath, rotateTransform, rubOrigin, smoothEllipse, zoneCorners, zonePoint,
  type Box, type Lattice, type Pt, type VElement, type VLine, type VStroke, type VText, type VZone,
} from '@/lib/design/vector';
import type { TraceBox } from '@/workbench/hooks/useTrace';
import { usePlacedVault } from '@/workbench/hooks/useVault';
import { ACCENT, INK, SANS, SERIF, STATUS_COLOR } from '../DesignArtboard';
import { SketchStroke } from '../SketchStroke';
import { toPoints } from './gesture';

const FONT = { serif: SERIF, sans: SANS, mono: 'ui-monospace, "SF Mono", Menlo, monospace' } as const;

type InlineEdit = { onChange: (text: string) => void; onDone: () => void };
type Placement = Box & { asset: string; tint?: string; layers?: string[]; projected?: boolean; turn?: number; mirror?: boolean };

// The tracing image. Not part of the page, so it can't be clicked, erased or exported.
export function TraceImage({ t }: { t: TraceBox }) {
  return <image href={t.url} x={t.x} y={t.y} width={t.w} height={t.h} opacity={t.opacity} preserveAspectRatio="none" pointerEvents="none" />;
}

export function Element({ el, all, bible, bibleId, editing, onOpen, inlineEdit }: {
  el: VElement; all: VElement[]; bible: Bible | null; bibleId: string; editing: boolean;
  onOpen: (pageId: string) => void;
  inlineEdit?: InlineEdit;
}) {
  const link = !editing && el.link ? el.link : undefined;
  return (
    <g data-el={el.id} opacity={el.opacity} transform={rotateTransform(el, all)} className={link ? 'vlink' : undefined} onClick={link ? () => onOpen(link) : undefined}>
      {link && <title>Open {link}</title>}
      <Filtered el={el}><Erased el={el} all={all}><Shape el={el} all={all} bible={bible} bibleId={bibleId} solid={editing || !!link} inlineEdit={inlineEdit} /></Erased></Filtered>
    </g>
  );
}

// An element with eraser marks, drawn with them as holes. Masks don't block clicks, so it can still be picked where it's rubbed out.
export function Erased({ el, all, children }: { el: VElement; all: VElement[]; children: ReactNode }) {
  const id = `rub${useId().replace(/:/g, '')}`;
  if (!el.erased?.length) return <>{children}</>;
  const o = rubOrigin(el, all);
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x={-1e5} y={-1e5} width={2e5} height={2e5}>
        <rect x={-1e5} y={-1e5} width={2e5} height={2e5} fill="white" />
        <g transform={`translate(${o.x} ${o.y})`} fill="none" stroke="black">
          {el.erased.map((r, i) => {
            const pts = []; for (let k = 0; k + 1 < r.pts.length; k += 2) pts.push(`${r.pts[k]},${r.pts[k + 1]}`);
            if (r.area) return <path key={i} d={`M${pts.join(' L')} Z`} fill="black" stroke="none" />;
            return <path key={i} d={`M${pts.join(' L')}${pts.length === 1 ? ` L${pts[0]}` : ''}`} strokeWidth={r.size} strokeLinecap={r.square ? 'square' : 'round'} strokeLinejoin={r.square ? 'miter' : 'round'} />;
          })}
        </g>
      </mask>
      <g mask={`url(#${id})`}>{children}</g>
    </>
  );
}

// An element with filter effects (blur…): drawn, then the filters over it, chained in the order they're listed
function Filtered({ el, children }: { el: VElement; children: ReactNode }) {
  const id = `fx${useId().replace(/:/g, '')}`, steps = filterSteps(el);
  if (!steps.length) return <>{children}</>;
  return (
    <>
      <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
        {steps.map(({ tag: Tag, attrs }, i) => <Tag key={i} {...attrs} in={i ? `fx${i - 1}` : 'SourceGraphic'} result={`fx${i}`} />)}
      </filter>
      <g filter={`url(#${id})`}>{children}</g>
    </>
  );
}

// A floor or roof shape with a height: its sides (in its color, shaded), then its face on top, raised
function Solid({ el, hit, children }: { el: VElement; hit?: 'all'; children: ReactNode }) {
  const ex = extrusion(el), down = roofWalls(el);
  const s = el as { fill?: string; stroke?: string; strokeWidth?: number };
  // A roof's walls down to the floor: drawn first, like a dented solid's walls (outline twice as thick, fill over it, shade)
  const walls = down && (
    <>
      <path d={down} fill="none" stroke={s.stroke ?? 'none'} strokeWidth={(s.strokeWidth ?? 2) * 2} strokeLinejoin="round" pointerEvents="none" />
      <path d={down} fill={s.fill} pointerEvents={hit} />
      {s.fill && <path d={down} fill="#000" fillOpacity={0.22} pointerEvents="none" />}
    </>
  );
  if (!ex) return <>{walls}{children}</>;
  return (
    <>
      {walls}
      {ex.walls ? <>
        {/* the walls' outline drawn twice as thick, then their fill over it: only the outside edge of them all is left */}
        <path d={ex.walls} fill="none" stroke={s.stroke ?? 'none'} strokeWidth={(s.strokeWidth ?? 2) * 2} strokeLinejoin="round" pointerEvents="none" />
        <path d={ex.walls} fill={s.fill} pointerEvents={hit} />
      </> : <path d={ex.sides} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.strokeWidth ?? 2} strokeLinejoin="round" pointerEvents={hit} />}
      {s.fill && <path d={ex.walls ?? ex.sides} fill="#000" fillOpacity={0.22} pointerEvents="none" />}
      <g transform={`translate(${ex.up.x} ${ex.up.y})`}>{children}</g>
    </>
  );
}

function Shape({ el, all, bible, bibleId, solid, inlineEdit }: {
  el: VElement; all: VElement[]; bible: Bible | null; bibleId: string; solid: boolean;
  inlineEdit?: InlineEdit;
}) {
  const hitAll = solid ? 'all' as const : undefined;  // an unfilled shape still takes clicks when it can be clicked
  // A shape effect (roughen…) changed its outline: it draws as that path, whatever shape it started as
  if ((el.type === 'rect' || el.type === 'ellipse' || el.type === 'capsule' || el.type === 'poly') && reshapes(el)) {
    const open = el.type === 'poly' && el.open, sw = el.strokeWidth ?? 2;
    return <Solid el={el} hit={hitAll}><path d={reshapedPath(el)} fill={open ? 'none' : el.fill ?? 'none'} stroke={el.stroke ?? 'none'} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" {...dashProps(el.dash, sw)} pointerEvents={hitAll} /></Solid>;
  }
  switch (el.type) {
    case 'rect':
      return <Solid el={el} hit={hitAll}><rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius} fill={el.fill ?? 'none'} stroke={el.stroke ?? 'none'} strokeWidth={el.strokeWidth ?? 2} {...dashProps(el.dash, el.strokeWidth ?? 2)} pointerEvents={hitAll} /></Solid>;
    case 'ellipse': {
      const paint = { fill: el.fill ?? 'none', stroke: el.stroke ?? 'none', strokeWidth: el.strokeWidth ?? 2, ...dashProps(el.dash, el.strokeWidth ?? 2), pointerEvents: hitAll };
      return (
        <Solid el={el} hit={hitAll}>
          {!smoothEllipse(el)
            ? <path d={ellipsePath(el)} strokeLinejoin="round" {...paint} />
            : <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} {...paint} />}
        </Solid>
      );
    }
    case 'poly':
      return <Solid el={el} hit={hitAll}><path d={polyPath(el)} fill={el.open ? 'none' : el.fill ?? 'none'} stroke={el.stroke ?? 'none'} strokeWidth={el.strokeWidth ?? 2} strokeLinejoin="round" strokeLinecap="round" {...dashProps(el.dash, el.strokeWidth ?? 2)} pointerEvents={hitAll} /></Solid>;
    case 'capsule':
      return <Solid el={el} hit={hitAll}><path d={capsulePath(el, el.taper)} fill={el.fill ?? 'none'} stroke={el.stroke ?? 'none'} strokeWidth={el.strokeWidth ?? 2} {...dashProps(el.dash, el.strokeWidth ?? 2)} pointerEvents={hitAll} /></Solid>;
    case 'zone': return <Zone el={el} solid={solid} />;
    case 'line': return <Line el={el} all={all} />;
    case 'stroke':
      return (
        <>
          <path d={`M ${el.points.map((p) => p.join(',')).join(' L ')}`} fill="none" stroke="transparent" strokeWidth={16} pointerEvents="stroke" />
          <Ink el={el} />
        </>
      );
    case 'image': {
      const fit = el.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
      return el.src.startsWith('idb:')   // kept in this browser (a web wireframe's images), not in a bible's assets/
        ? <IdbImage id={el.src.slice(4)} x={el.x} y={el.y} w={el.w} h={el.h} fit={fit} />
        : <image href={`/api/design?bible=${bibleId}&asset=${encodeURIComponent(el.src)}`} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio={fit} />;
    }
    case 'asset': return <AssetDrawing el={el} solid={solid} />;
    case 'status': return <StatusDot el={el} status={bible?.topics.find((t) => t.id === el.topic)?.status ?? 'blank'} />;
    case 'text': return <TextBox el={el} bible={bible} inlineEdit={inlineEdit} />;
  }
}

function IdbImage({ id, x, y, w, h, fit }: { id: string; x: number; y: number; w: number; h: number; fit: string }) {
  const url = useAssetUrl(id);
  return url ? <image href={url} x={x} y={y} width={w} height={h} preserveAspectRatio={fit} />
    : <rect x={x} y={y} width={w} height={h} fill="none" stroke="#a8a29e" strokeDasharray="8 6" strokeWidth={2} />;
}

const gridOfAsset = (a: VaultAsset) => !!gridOf(a).flat;

// A vault asset in its box, live: it changes wherever it's placed when the asset changes.
export function AssetDrawing({ el, solid }: { el: Placement; solid?: boolean }) {
  const { entries, loaded } = usePlacedVault();   // a structure comes built from its atoms, live
  const asset = entries.find((e) => e.id === el.asset)?.asset;
  if (!asset) return (   // missing from the vault: its box is all there is to click
    <>
      {solid && <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" pointerEvents="all" />}
      {loaded && <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#dc2626" fillOpacity={0.08} stroke="#dc2626" strokeWidth={2} strokeDasharray="8 6" vectorEffect="non-scaling-stroke"><title>{`"${el.asset}" isn't in the vault`}</title></rect>}
    </>
  );
  return <PosedAsset asset={asset} el={el} hit={solid} />;   // clicked where it's drawn, not anywhere in its box
}

// A vault asset drawn in a placement's box, as placed: projected onto the floor's view, turned, mirrored, tinted.
// Pure (no vault lookup), so scripts draw assets with exactly this (scripts/asset-render.tsx).
export function PosedAsset({ asset, el, hit }: { asset: VaultAsset; el: Placement; hit?: boolean }) {
  // A projected block is drawn in the other view: the floor's, which is the one its sheet isn't
  const flat = el.projected ? !gridOfAsset(asset) : undefined, v = assetView(asset, flat, el);
  // A block is posed (turned, mirrored, projected); any other asset only flips sideways when mirrored
  const pose = asset.kind === 'block' ? blockPose(asset, flat, el) : null, shown = pose?.shown ?? asset;
  const transform = pose ? pose.transform : el.mirror ? `matrix(-1 0 0 1 ${2 * v.x + v.w} 0)` : undefined;
  const els = tintElements(projectedElements(shown, flat), el.tint);
  return (
    <svg data-asset={el.asset} x={el.x} y={el.y} width={el.w} height={el.h} viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} overflow="visible" pointerEvents={hit ? 'visiblePainted' : 'none'}>
      <g transform={transform}>
        {drawOrder(els, layersOf(shown), el.layers).map((x) => (
          <g key={x.id} opacity={x.opacity} transform={rotateTransform(x, els)}><Filtered el={x}><Erased el={x} all={els}><Shape el={x} all={els} bible={null} bibleId="" solid={false} /></Erased></Filtered></g>
        ))}
      </g>
    </svg>
  );
}

export function Ink({ el }: { el: Pick<VStroke, 'points' | 'pressures' | 'color' | 'width' | 'brush'> }) {
  return (
    <SketchStroke
      points={el.points} pressures={el.brush ? undefined : el.pressures} color={el.color ?? INK}
      width={el.width} cap={el.brush === 'highlighter' ? 'butt' : 'round'}
    />
  );
}

function Zone({ el, solid }: { el: VZone; solid: boolean }) {
  let tiles = '';
  if (!el.noLines) {
    const seg = (p: Pt, q: Pt) => `M${p.x},${p.y}L${q.x},${q.y}`;
    for (let a = 1; a < el.cols; a++) tiles += seg(zonePoint(el, a, 0), zonePoint(el, a, el.rows));
    for (let b = 1; b < el.rows; b++) tiles += seg(zonePoint(el, 0, b), zonePoint(el, el.cols, b));
  }
  return (
    <>
      <polygon points={toPoints(zoneCorners(el))} fill={el.fill ?? 'none'} pointerEvents={solid ? 'all' : undefined} />
      {tiles && <path d={tiles} fill="none" stroke={el.stroke ?? INK} strokeOpacity={0.22} strokeWidth={1} pointerEvents="none" />}
      <polygon points={toPoints(zoneCorners(el))} fill="none" stroke={el.stroke ?? 'none'} strokeWidth={el.strokeWidth ?? 3} strokeLinejoin="round" {...dashProps(el.dash, el.strokeWidth ?? 3)} pointerEvents="none" />
    </>
  );
}

// The placement grid, under everything. Its lines stay one screen px at any zoom.
export function GridLines({ g, line }: { g: Lattice; line: number }) {
  const c = g.cell, w = g.flat ? c : 2 * c;
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="vector-grid" patternUnits="userSpaceOnUse" width={w} height={c}>
          <path d={g.flat ? `M${c},0L0,0L0,${c}` : `M0,0L${w},${c}M0,${c}L${w},0`} fill="none" stroke="#8a8378" strokeOpacity={0.45} strokeWidth={line} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#vector-grid)" />
    </g>
  );
}

function Line({ el, all }: { el: VLine; all: VElement[] }) {
  const [a, b] = lineEnds(el, all);
  const ctrl = lineControl(a, b, el.bend);
  const d = ctrl ? `M${a.x},${a.y} Q${ctrl.x},${ctrl.y} ${b.x},${b.y}` : `M${a.x},${a.y} L${b.x},${b.y}`;
  const color = el.stroke ?? INK, sw = el.strokeWidth ?? 3, arrow = el.arrow ?? 'end';
  const head = (tip: Pt, tail: Pt) => {
    const len = Math.hypot(tip.x - tail.x, tip.y - tail.y) || 1;
    const ux = (tip.x - tail.x) / len, uy = (tip.y - tail.y) / len, s = 8 + sw * 2.5;
    return `${tip.x},${tip.y} ${tip.x - ux * s - uy * s * 0.55},${tip.y - uy * s + ux * s * 0.55} ${tip.x - ux * s + uy * s * 0.55},${tip.y - uy * s - ux * s * 0.55}`;
  };
  return (
    <>
      <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(16, sw)} pointerEvents="stroke" />
      <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" {...dashProps(el.dash, sw)} />
      {arrow !== 'none' && <polygon points={head(b, ctrl ?? a)} fill={color} />}
      {arrow === 'both' && <polygon points={head(a, ctrl ?? b)} fill={color} />}
    </>
  );
}

function StatusDot({ el, status }: { el: Extract<VElement, { type: 'status' }>; status: TopicStatus }) {
  const s = el.size ?? 20, r = s / 2, cx = el.x + r, cy = el.y + r, c = STATUS_COLOR[status], sw = Math.max(2, s / 8);
  if (status === 'decided') return <circle cx={cx} cy={cy} r={r} fill={c} />;
  if (status === 'blank') return <circle cx={cx} cy={cy} r={r - sw / 2} fill="transparent" stroke={c} strokeWidth={sw} strokeDasharray={`${s / 5} ${s / 6}`} />;
  return (
    <>
      <circle cx={cx} cy={cy} r={r - sw / 2} fill="transparent" stroke={c} strokeWidth={sw} />
      <path d={`M${cx},${cy - r} A${r},${r} 0 0 0 ${cx},${cy + r} Z`} fill={c} />
    </>
  );
}

function TextBox({ el, bible, inlineEdit }: { el: VText; bible: Bible | null; inlineEdit?: InlineEdit }) {
  const topic = el.bind ? bible?.topics.find((t) => t.id === el.bind!.topic) : undefined;
  const text = el.bind ? (topic?.[el.bind.field] ?? '') : el.text;
  const type: React.CSSProperties = {
    fontSize: el.size ?? 24, fontWeight: el.weight ?? 400, fontFamily: FONT[el.font ?? 'sans'], color: el.color ?? INK,
    textAlign: el.align ?? 'left', lineHeight: 1.3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
    ...(el.caps && { textTransform: 'uppercase', letterSpacing: '0.16em' }),
  };
  const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.valign ?? 'top'];
  const shape = el.bg ? el.bgShape ?? 'block' : null;
  const padX = shape === 'ellipse' ? el.w * 0.15 : shape ? 12 : 0, padY = shape === 'ellipse' ? el.h * 0.15 : shape ? 8 : 0;
  const body = (
    <foreignObject x={el.x + padX} y={el.y + padY} width={Math.max(el.w - 2 * padX, 1)} height={Math.max(el.h - 2 * padY, 1)}>
      {inlineEdit ? (
        <textarea
          autoFocus value={el.text} placeholder="Type…"
          style={{ ...type, display: 'block', width: '100%', height: '100%', resize: 'none', overflow: 'hidden', scrollbarWidth: 'none', background: 'rgba(255,255,255,0.7)', border: 'none', outline: `2px solid ${ACCENT}`, padding: 0 }}
          onChange={(e) => inlineEdit.onChange(e.target.value)} onBlur={inlineEdit.onDone}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') e.currentTarget.blur(); }}
        />
      ) : (
        <div data-text={el.id} style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: justify }}>
          <div style={{ ...type, flexShrink: 0 }}>{text}</div>
        </div>
      )}
    </foreignObject>
  );
  if (!shape) return body;
  return (
    <>
      {shape === 'ellipse'
        ? <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={el.bg} />
        : <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={shape === 'pill' ? Math.min(el.w, el.h) / 2 : shape === 'round' ? 16 : 0} fill={el.bg} />}
      {body}
    </>
  );
}
