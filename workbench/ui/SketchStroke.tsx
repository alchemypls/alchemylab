"use client";

import { memo } from 'react';

// Renders a sketch 'stroke'. Plain strokes (mouse) are one fixed-width path. Pressure strokes
// (pen tablets) vary width per segment — rendered as at most WIDTH_BUCKETS paths (segments
// grouped by quantized width), not one <line> per segment: a dense pen stroke is thousands of
// segments, and per-segment DOM nodes made every surface showing sketches slow to re-render.

const BASE = 4;
const WIDTH_BUCKETS = 6;
export const pressureWidth = (p: number) => BASE * (0.35 + 1.3 * p);

const MIN_W = pressureWidth(0), MAX_W = pressureWidth(1);
const bucketOf = (w: number) => Math.min(WIDTH_BUCKETS - 1, Math.floor(((w - MIN_W) / (MAX_W - MIN_W)) * WIDTH_BUCKETS));
const bucketWidth = (b: number) => MIN_W + ((b + 0.5) / WIDTH_BUCKETS) * (MAX_W - MIN_W);

export const SketchStroke = memo(function SketchStroke({ points, pressures, color, width = BASE, cap = 'round' }: {
  points: [number, number][]; pressures?: number[]; color: string;
  width?: number;              // a plain stroke's width; a pressure stroke scales around it
  cap?: 'round' | 'butt';
}) {
  const scale = width / BASE;
  if (!pressures || pressures.length !== points.length) {
    if (points.length === 1) return <circle cx={points[0][0]} cy={points[0][1]} r={width / 2} fill={color} />;
    const d = `M ${points.map((p) => p.join(',')).join(' L ')}`;
    return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap={cap} strokeLinejoin="round" />;
  }
  if (points.length === 1) {
    return <circle cx={points[0][0]} cy={points[0][1]} r={(pressureWidth(pressures[0]) * scale) / 2} fill={color} />;
  }
  // Consecutive segments in the same bucket join into one subpath
  const d: string[] = Array.from({ length: WIDTH_BUCKETS }, () => '');
  let prev = -1;
  for (let i = 1; i < points.length; i++) {
    const b = bucketOf(pressureWidth((pressures[i - 1] + pressures[i]) / 2));
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    d[b] += b === prev ? ` L${x1},${y1}` : ` M${x0},${y0} L${x1},${y1}`;
    prev = b;
  }
  return (
    <g stroke={color} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {d.map((path, b) => path && <path key={b} d={path} strokeWidth={bucketWidth(b) * scale} />)}
    </g>
  );
});
