// Pen tablet calibration — the sub-rectangle of a tablet's reported 0..1 area that should map
// onto the page (e.g. the reMarkable's drawing area minus its left toolbar). Per source, per
// browser: this is device setup, not project data, so it lives in localStorage.

export interface PenCalib { x0: number; x1: number; y0: number; y1: number }

const key = (source: string) => `alchemy:penCalib:${source}`;

export function loadCalib(source: string): PenCalib | null {
  try {
    const raw = localStorage.getItem(key(source));
    return raw ? (JSON.parse(raw) as PenCalib) : null;
  } catch { return null; }
}

export function saveCalib(source: string, c: PenCalib | null) {
  try {
    if (c) localStorage.setItem(key(source), JSON.stringify(c));
    else localStorage.removeItem(key(source));
  } catch { /* storage unavailable — calibration just won't persist */ }
}

export const applyCalib = (c: PenCalib | null, x: number, y: number): [number, number] =>
  c ? [(x - c.x0) / (c.x1 - c.x0), (y - c.y0) / (c.y1 - c.y0)] : [x, y];

// Bounds of a hand-traced loop. Min/max would catch corner overshoot, so each edge is the
// median of the points hugging it (outer 15% band, corners excluded). Null if too small/sparse.
export function boundsFromTrace(pts: [number, number][]): PenCalib | null {
  if (pts.length < 20) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
  const w = bx1 - bx0, h = by1 - by0;
  if (w < 0.1 || h < 0.1) return null;
  const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const inX = (x: number) => x > bx0 + 0.15 * w && x < bx1 - 0.15 * w;
  const inY = (y: number) => y > by0 + 0.15 * h && y < by1 - 0.15 * h;
  const edge = (sel: (p: [number, number]) => boolean, axis: 0 | 1, fallback: number) => {
    const v = pts.filter(sel).map((p) => p[axis]);
    return v.length >= 3 ? median(v) : fallback;
  };
  return {
    x0: edge(([x, y]) => x < bx0 + 0.15 * w && inY(y), 0, bx0),
    x1: edge(([x, y]) => x > bx1 - 0.15 * w && inY(y), 0, bx1),
    y0: edge(([x, y]) => y < by0 + 0.15 * h && inX(x), 1, by0),
    y1: edge(([x, y]) => y > by1 - 0.15 * h && inX(x), 1, by1),
  };
}

// Quarter turn of a tablet held sideways: 1 = its top edge points right, -1 = left.
export type PenTurn = 0 | 1 | -1;

const turnKey = (source: string) => `alchemy:penTurn:${source}`;

export function loadTurn(source: string): PenTurn {
  try {
    const n = Number(localStorage.getItem(turnKey(source)));
    return n === 1 || n === -1 ? n : 0;
  } catch { return 0; }
}

export function saveTurn(source: string, t: PenTurn) {
  try { localStorage.setItem(turnKey(source), String(t)); } catch { /* just won't persist */ }
}

// Tablet sample (0..1) → position on a fixed-size sheet (0..1), or null when the pen is off it.
// The sheet is letterboxed inside the tablet area so strokes aren't stretched. Unlike a page that
// grows, a fixed sheet can't take everything: what's outside the letterbox is simply off the page.
export function penToSheet(
  x: number, y: number,
  { aspect, calib, turn, sheetAspect }: { aspect: number; calib: PenCalib | null; turn: PenTurn; sheetAspect: number },
): [number, number] | null {
  const EDGE = 1e-9;   // rounding must not push a sample that's on the edge off the sheet
  const off = (n: number) => n < -EDGE || n > 1 + EDGE;
  const [cx, cy] = applyCalib(calib, x, y);
  if (off(cx) || off(cy)) return null;
  const area = aspect * (calib ? (calib.x1 - calib.x0) / (calib.y1 - calib.y0) : 1);
  let u = turn === 1 ? 1 - cy : turn === -1 ? cy : cx;
  let v = turn === 1 ? cx : turn === -1 ? 1 - cx : cy;
  const held = turn ? 1 / area : area;
  if (sheetAspect < held) { const f = sheetAspect / held; u = (u - (1 - f) / 2) / f; }
  else                    { const f = held / sheetAspect; v = (v - (1 - f) / 2) / f; }
  return off(u) || off(v) ? null : [Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))];
}
