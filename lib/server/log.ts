// The dev server's own log: one line per thing that happened to the files on disk, under Next's request lines.
// Next says "PUT /api/vault?asset=x 409"; this says what that save changed, or why it was refused, and when a file
// changed on disk from outside the app (the agent, an editor). Plain console output; NO_COLOR turns the colors off.
//
//   12:04:31 ✓ vault/assets/cave-dungeon.json  ~1 poly-d7ew: x, y
//   12:04:33 ⚠ vault/assets/cave-dungeon.json  409 refused: changed on disk 1.2s after your copy
//   12:04:40 ↻ vault/assets/town.json  changed outside the app

import path from 'path';

const ROOT = process.cwd();
const tint = (code: number) => (s: string) => (process.env.NO_COLOR ? s : `\x1b[${code}m${s}\x1b[0m`);
const dim = tint(2), green = tint(32), yellow = tint(33), red = tint(31), magenta = tint(35);
const stamp = () => dim(new Date().toTimeString().slice(0, 8));
const rel = (file: string) => path.relative(ROOT, file);
const quiet = !!process.env.VITEST;   // the API tests make files on purpose
const line = (mark: string, file: string, what: string) => { if (!quiet) console.log(`${stamp()} ${mark} ${rel(file)}  ${what}`); };

// ── What a save changed ── by element id when both sides have elements (pages, vault files), else by top-level field
type Obj = Record<string, unknown>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const fieldsChanged = (a: Obj, b: Obj) => Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).filter((k) => !same(a[k], b[k]));
const list = (xs: string[], max = 4) => (xs.length > max ? `${xs.slice(0, max).join(', ')} +${xs.length - max}` : xs.join(', '));

export function describeChange(before: unknown, after: unknown): string {
  if (before === undefined) return 'new file';
  if (!isObj(before) || !isObj(after)) return same(before, after) ? 'no change' : 'replaced';
  const parts: string[] = [];
  const els = (o: Obj) => (Array.isArray(o.elements) ? (o.elements as Obj[]) : null);
  const ea = els(before), eb = els(after);
  if (ea && eb) {
    const was = new Map(ea.map((e) => [String(e.id), e])), now = new Map(eb.map((e) => [String(e.id), e]));
    const added = eb.filter((e) => !was.has(String(e.id))), removed = ea.filter((e) => !now.has(String(e.id)));
    const changed = eb.filter((e) => was.has(String(e.id)) && !same(was.get(String(e.id)), e));
    const named = (xs: Obj[]) => list(xs.map((e) => `${e.type} ${e.id}`));
    if (added.length) parts.push(green(`+${added.length}`) + ` ${named(added)}`);
    if (removed.length) parts.push(red(`−${removed.length}`) + ` ${named(removed)}`);
    if (changed.length === 1) parts.push(yellow('~1') + ` ${changed[0].id}: ${list(fieldsChanged(was.get(String(changed[0].id))!, changed[0]), 6)}`);
    else if (changed.length) parts.push(yellow(`~${changed.length}`) + ` ${list(changed.map((e) => String(e.id)))}`);
    const order = !added.length && !removed.length && !same(ea.map((e) => e.id), eb.map((e) => e.id));
    if (order) parts.push('reordered');
  }
  const top = fieldsChanged(before, after).filter((k) => !(k === 'elements' && ea && eb) && k !== 'updated');
  if (top.length) parts.push(list(top));
  return parts.join(' · ') || 'no change';
}

const ago = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 60_000)}min`);

// Writes this server made, so the watcher can tell them from outside edits
const g = globalThis as typeof globalThis & { __ownWrites?: Map<string, number> };
const own = (g.__ownWrites ??= new Map());
const OWN_MS = 2000;

export const log = {
  saved(file: string, before: unknown, after: unknown, warnings: string[] = []) {
    own.set(file, Date.now());
    const warn = warnings.length ? yellow(`  ${warnings.length} warning${warnings.length > 1 ? 's' : ''}: ${warnings[0]}`) : '';
    line(green('✓'), file, describeChange(before, after) + warn);
  },
  // A stale save: the canvas edited from an older copy (base) than what's on disk (current), both mtimes in ms
  stale(file: string, base: string, current: string) {
    const d = Number(current) - Number(base);
    line(yellow('⚠'), file, `409 refused: changed on disk ${ago(Math.abs(d))} ${d >= 0 ? 'after' : 'before'} the copy it was edited from; disk wins, that edit was dropped`);
  },
  refused(file: string, status: number, why: string, more: string[] = []) {
    line(status === 422 ? red('✗') : yellow('⚠'), file, `${status} ${why}${more.length > 1 ? dim(`  (+${more.length - 1} more)`) : ''}`);
  },
  deleted(file: string, note = '') {
    own.set(file, Date.now());
    line(red('−'), file, `deleted${note ? ` ${note}` : ''}`);
  },
  uploaded(file: string, bytes: number) {
    own.set(file, Date.now());
    line(green('✓'), file, `image, ${(bytes / 1024).toFixed(0)} KB`);
  },
  // From the folder watcher: anything this server didn't just write was changed by someone else
  changed(file: string) {
    const t = own.get(file);
    if (t && Date.now() - t < OWN_MS) return;
    line(magenta('↻'), file, 'changed outside the app');
  },
};
