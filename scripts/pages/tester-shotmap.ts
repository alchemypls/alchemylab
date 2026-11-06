// The main-table shot map on pinball-crawl/tester, as code: `node scripts/run.cjs scripts/pages/tester-shotmap.ts`.
// Replaces only its own elements (ids `sm-`) and layers; everything else on the page stays.
import fs from 'fs';
import { fitBlocks, footingOf, placedSize, blockPose, blockProjection, type VaultAsset } from '@/lib/design/vault';

const FILE = 'design/pinball-crawl/pages/tester.json';
const page = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const asset = (id: string) => JSON.parse(fs.readFileSync(`vault/assets/${id}.json`, 'utf8')) as VaultAsset;

const X0 = 2208, Y0 = 48, S = 24, COLS = 21, ROWS = 42, AXIS = 10;
const P = (u: number, v: number) => ({ x: Math.round((X0 + u * S) * 100) / 100, y: Math.round((Y0 + v * S) * 100) / 100 });
const R = (n: number) => Math.round(n * 100) / 100;
const INK = '#1f1b16', WOOD = '#c9a36b', CAB = '#2a2623', CHROME = '#9aa0a6', BLUE = '#2f6fd6', RED = '#d6332f', YELLOW = '#f2c230', PAPER = '#d9c9a3';
type El = Record<string, unknown>;
const out: El[] = [];
const PLAY = 'sm-play', SHOTS = 'sm-shots', FLOOR = 'sm-floor';   // drawings on the table are painted on its floor (`on`): they follow it when the view flips

// Any outline in inches → a poly element
function poly(id: string, pts: [number, number][], o: El, layer = PLAY): El {
  const q = pts.map(([u, v]) => P(u, v)), xs = q.map((p) => p.x), ys = q.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x || 1, h = Math.max(...ys) - y || 1;
  const el = { id, type: 'poly', x: R(x), y: R(y), w: R(w), h: R(h), pts: q.map((p) => [R((p.x - x) / w * 1e4) / 1e4, R((p.y - y) / h * 1e4) / 1e4]), on: FLOOR, ...o, layer };
  out.push(el); return el;
}
const arc = (cu: number, cv: number, r: number, a0: number, a1: number, n = 16): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + (a1 - a0) * (i / n)) * Math.PI) / 180; return [R(cu + r * Math.cos(a)), R(cv + r * Math.sin(a))]; });
const mir = (pts: [number, number][]): [number, number][] => pts.map(([u, v]) => [2 * AXIS - u, v]);

// A block standing on tiles (a, b) (its posed footprint's top-left tile)
function place(id: string, assetId: string, a: number, b: number, pose: { turn?: number; mirror?: boolean } = {}, extra: El = {}) {
  const A = asset(assetId), bp = blockPose(A, true, pose), fp = bp.footprint;
  const { w, h } = placedSize(A, S, true, pose), at = footingOf(A, true, pose)!.at!;
  const c = P(a + fp.cols / 2, b + fp.rows / 2);
  const el = { id, type: 'asset', asset: assetId, x: R(c.x - w * at.x), y: R(c.y - h * at.y), w, h, at: { x: R(at.x * 1e4) / 1e4, y: R(at.y * 1e4) / 1e4 },
    ...(blockProjection(A, true) ? { projected: true } : {}), ...(pose.turn ? { turn: pose.turn } : {}), ...(pose.mirror ? { mirror: true } : {}), layer: PLAY, ...extra };
  out.push(el); return el;
}
const text = (id: string, x: number, y: number, w: number, h: number, t: string, o: El = {}) => {
  const el = { id, type: 'text', x, y, w, h, text: t, size: 14, color: INK, font: 'sans', ...o, layer: SHOTS }; out.push(el); return el;
};
const line = (id: string, from: El | { x: number; y: number }, to: El | { x: number; y: number }, o: El = {}, layer = SHOTS) => {
  const end = (e: El | { x: number; y: number }) => ('id' in e ? { el: e.id } : e);
  const el = { id, type: 'line', from: end(from), to: end(to), ...o, layer }; out.push(el); return el;
};

// ── the table ───────────────────────────────────────────────
out.push({ id: FLOOR, type: 'zone', x: X0, y: Y0, cols: COLS, rows: ROWS, cell: S, flat: true, fill: WOOD, stroke: '#b08b55', strokeWidth: 0.5, layer: PLAY });
const C0 = COLS / 2, RAD = COLS / 2;   // the arch over the top: center (10.5, 10.5)
poly('sm-cab-l', [[0, 0], ...arc(C0, RAD, RAD, -90, -180)], { fill: CAB, stroke: 'none' });
poly('sm-cab-r', [[COLS, 0], ...arc(C0, RAD, RAD, -90, 0)], { fill: CAB, stroke: 'none' });
poly('sm-wall', [[0, 42], ...arc(C0, RAD, RAD, 180, 360, 24), [COLS, 42]], { open: true, fill: 'none', stroke: INK, strokeWidth: 3 });
poly('sm-shooter-wall', [[19.5, 12], [19.5, 41.6]], { open: true, fill: 'none', stroke: INK, strokeWidth: 2 });
const orbitL: [number, number][] = [[2.5, 25.5], [2.5, 10.5], ...arc(C0, RAD, 8, 180, 235, 8)];
poly('sm-orbit-l', orbitL, { open: true, fill: 'none', stroke: INK, strokeWidth: 2 });
poly('sm-orbit-r', [[17.5, 25.5], [17.5, 10.5], ...arc(C0, RAD, 7, 0, -50, 8)], { open: true, fill: 'none', stroke: INK, strokeWidth: 2 });
const sepL: [number, number][] = [[1.5, 30.5], [1.5, 35.5]], inL: [number, number][] = [[3, 30.2], [3, 35.2], [6.2, 37]];
poly('sm-sep-l', sepL, { open: true, fill: 'none', stroke: INK, strokeWidth: 2 });
poly('sm-sep-r', mir(sepL), { open: true, fill: 'none', stroke: INK, strokeWidth: 2 });
poly('sm-inlane-l', inL, { open: true, fill: 'none', stroke: INK, strokeWidth: 2 });
poly('sm-inlane-r', mir(inL), { open: true, fill: 'none', stroke: INK, strokeWidth: 2 });
poly('sm-apron-l', [[0, 39.4], [8.2, 39.4], [8.2, 42], [0, 42]], { fill: PAPER, stroke: INK, strokeWidth: 1.5 });
poly('sm-apron-r', [[11.8, 39.4], [19.5, 39.4], [19.5, 42], [11.8, 42]], { fill: PAPER, stroke: INK, strokeWidth: 1.5 });
// wire returns from the ramps' tops to the inlanes
const wireL: [number, number][] = [[4.5, 13.2], [4.5, 11.6], [3.4, 10.6], [1.25, 12.6], [1.25, 29], [2.25, 31.2], [2.25, 33]];
poly('sm-wire-l', wireL, { open: true, fill: 'none', stroke: CHROME, strokeWidth: 4, opacity: 0.85 });
poly('sm-wire-r', mir(wireL), { open: true, fill: 'none', stroke: CHROME, strokeWidth: 4, opacity: 0.85 });

// shot inserts: lit arrows in front of each shot
const TRI: [number, number][] = [[0.5, 0], [1, 1], [0, 1]];
const insert = (id: string, u: number, v: number, fill: string) => poly(id, TRI.map(([a, b]) => [u - 0.45 + a * 0.9, v - 0.65 + b * 1.3] as [number, number]), { fill, stroke: INK, strokeWidth: 1 });
const insOL = insert('sm-ins-orbit-l', 1.25, 23.5, BLUE), insRL = insert('sm-ins-ramp-l', 4.5, 25, YELLOW), insC = insert('sm-ins-gate', 10, 23.5, RED);
const insRR = insert('sm-ins-ramp-r', 15.5, 25, YELLOW), insOR = insert('sm-ins-orbit-r', 18.5, 23.5, BLUE);

// blocks
const flipL = place('sm-flipper-l', 'flipper', 6, 37, { turn: 30 }), flipR = place('sm-flipper-r', 'flipper', 11, 37, { turn: -30, mirror: true });
const slingL = place('sm-sling-l', 'slingshot', 3, 31); place('sm-sling-r', 'slingshot', 14, 31, { mirror: true });
place('sm-post-orbit-l', 'post', 2, 25); place('sm-post-orbit-r', 'post', 17, 25);
const sepPost = place('sm-post-sep-l', 'post', 1, 30); place('sm-post-sep-r', 'post', 18, 30);
const pops = [place('sm-pop-1', 'pop-bumper', 7, 7), place('sm-pop-2', 'pop-bumper', 11, 7), place('sm-pop-3', 'pop-bumper', 9, 10)];
const lanes = [7, 9, 11, 13].map((u, i) => place(`sm-lane-${i}`, 'lane-guide', u, 3));
const rampL = place('sm-ramp-l', 'ramp', 3, 13), rampR = place('sm-ramp-r', 'ramp', 14, 13);
const spinner = place('sm-spinner', 'spinner', 0, 17);
const saucer = place('sm-saucer', 'saucer', 9, 17);
[8, 9, 10, 11].forEach((u, i) => place(`sm-mob-${i}`, 'drop-target', u, 20));
const shops = [26, 27, 28].map((v, i) => place(`sm-shop-${i}`, 'standup', 18, v, { turn: 90 }));
place('sm-ball', 'ball', 20, 32);
const plunger = place('sm-shooter', 'shooter', 20, 33, { turn: 90 });
void flipL; void flipR; void slingL;

// ── the shot map ─────────────────────────────────────────────
const fromL = P(8.2, 37.2), fromR = P(11.8, 37.2);
const shot = (id: string, from: { x: number; y: number }, u: number, v: number, color: string) =>
  line(id, from, P(u, v), { stroke: color, strokeWidth: 2.5, arrow: 'end', on: FLOOR });
shot('sm-shot-l-ramp-r', fromL, 15.5, 22.3, BLUE); shot('sm-shot-l-orbit-r', fromL, 18.5, 21.8, BLUE);
shot('sm-shot-l-gate', fromL, 9.6, 21.7, BLUE); shot('sm-shot-l-shops', fromL, 17.9, 27.6, BLUE);
shot('sm-shot-r-ramp-l', fromR, 4.5, 22.3, RED); shot('sm-shot-r-orbit-l', fromR, 1.25, 21.8, RED);
shot('sm-shot-r-gate', fromR, 10.4, 21.7, RED);
poly('sm-path-orbit', [[1.25, 21.5], [1.25, 10.5], ...arc(C0, RAD, 9.25, 180, 360, 24), [18.5, 21.5]], { open: true, fill: 'none', stroke: INK, strokeWidth: 1.5, dash: true }, SHOTS);

// callouts: left margin and right margin, a leader to what they name
const LX = 1904, RX = 2752, TW = 248;
const callout = (id: string, side: 'l' | 'r', y: number, h: number, title: string, body: string, target: El) => {
  const align = side === 'l' ? 'right' : 'left', x = side === 'l' ? LX : RX;
  const t = text(id, x, y, TW, 20, title, { align, weight: 700, size: 14 });
  text(`${id}-body`, x, y + 20, TW, h - 16, body, { align, size: 12, color: '#4a453e' });
  void t; line(`${id}-lead`, { x: side === 'l' ? x + TW + 8 : x - 8, y: y + 11 }, target, { stroke: INK, strokeWidth: 1, arrow: 'none' });
};
text('sm-title', LX, 48, TW, 36, 'MAIN TABLE · SHOT MAP', { size: 18, weight: 700, align: 'right' });
text('sm-sub', LX, 88, TW, 40, 'Draft for Pinball Crawl. 21 × 42 in, 1 tile = 1 in. Top-down, like a service manual.', { size: 12, align: 'right', color: '#5b5f63' });
callout('sm-c-lanes', 'l', 168, 56, 'TOP LANES', 'Skill shot: flippers move the lit lane.', lanes[0]);
callout('sm-c-spin', 'l', 360, 56, 'LEFT ORBIT · SPINNER', 'Loops over the top to the right orbit.', spinner);
callout('sm-c-ramp-l', 'l', 470, 56, 'CRYPT RAMP', 'Wire return to the left inlane.', rampL);
callout('sm-c-ins', 'l', 590, 56, 'SHOT ARROWS', 'Light for quests and jackpots.', insRL);
callout('sm-c-lanes-bot', 'l', 752, 56, 'INLANES / OUTLANES', 'Outlane = drain. Inlane feeds the flipper.', sepPost);
callout('sm-c-pops', 'r', 168, 56, 'POP BUMPERS', 'Mob nest: every hit earns gold.', pops[1]);
callout('sm-c-ramp-r', 'r', 330, 56, 'TOWER RAMP', 'Wire return to the right inlane.', rampR);
callout('sm-c-gate', 'r', 430, 72, 'DUNGEON GATE', 'Break the 4 mobs (drop targets); the saucer opens the dungeon.', saucer);
callout('sm-c-orbit-r', 'r', 560, 56, 'RIGHT ORBIT', 'Loops to the left orbit.', insOR);
callout('sm-c-shops', 'r', 660, 56, 'SHOPS ×3', 'Shoot the one you can afford.', shops[1]);
callout('sm-c-plunger', 'r', 860, 56, 'PLUNGER', 'Plunge feeds the right orbit.', plunger);
// legend
const LG = 940;
line('sm-key-l', { x: LX + 8, y: LG + 10 }, { x: LX + 56, y: LG + 10 }, { stroke: BLUE, strokeWidth: 2.5, arrow: 'end' });
text('sm-key-l-t', LX + 64, LG, 184, 20, 'from the left flipper', { size: 12 });
line('sm-key-r', { x: LX + 8, y: LG + 36 }, { x: LX + 56, y: LG + 36 }, { stroke: RED, strokeWidth: 2.5, arrow: 'end' });
text('sm-key-r-t', LX + 64, LG + 26, 184, 20, 'from the right flipper', { size: 12 });
line('sm-key-p', { x: LX + 8, y: LG + 62 }, { x: LX + 56, y: LG + 62 }, { stroke: INK, strokeWidth: 1.5, dash: true, arrow: 'none' });
text('sm-key-p-t', LX + 64, LG + 52, 184, 20, 'ball path', { size: 12 });
void insOL; void insC; void insRR;

// write: replace any earlier shot-map pass, keep everything else
page.elements = [...page.elements.filter((e: El) => !String(e.id).startsWith('sm-')), ...out];
page.layers = [...page.layers.filter((l: El) => !String(l.id).startsWith('sm-')), { id: PLAY, name: 'Shot map table' }, { id: SHOTS, name: 'Shot map shots' }];
page.size = { width: 3072, height: 1080 };
page.updated = '2026-11-05';
const fitted = fitBlocks(page, (id) => asset(id));
const moved = (fitted.elements ?? []).filter((e, i) => e !== page.elements[i] && e.id.startsWith('sm-')).map((e) => e.id);
if (moved.length) console.log('refit:', moved.join(' '));
fs.writeFileSync(FILE, JSON.stringify(fitted, null, 2) + '\n');
console.log(out.length, 'elements');
