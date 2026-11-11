// The vault's files, shared by the canvases and the agent (who writes them directly). Local dev tool only.
// Two folders: vault/assets/ (vector shapes and icons) and vault/palettes/ (named colors).
//
//   GET    /api/vault[?type=palette]   → [{ id, mtime, asset }] (type defaults to asset)
//   GET    /api/vault?uses=id          → { usedIn: ["bible/page", …] }  (assets only)
//   PUT    /api/vault?asset=id         → write vault/assets/id.json. Validated (422). Send x-base-mtime = the mtime
//          /api/vault?palette=id         you edited from: if the file changed since, 409. With &new=1, 409 if it exists.
//   DELETE /api/vault?asset=id         → remove it. 409 + usedIn if a page uses it, unless &force=1.
//          /api/vault?palette=id         (palettes are copied from, never linked, so they delete freely)

import { promises as fs } from 'fs';
import path from 'path';
import { SLUG } from '@/lib/design/types';
import { validateAsset } from '@/lib/design/validate';
import { usesAsset } from '@/lib/design/vault';
import { validatePalette } from '@/lib/design/palette';
import { log } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VAULT = path.join(process.cwd(), 'vault');
const DESIGN = path.join(process.cwd(), 'design');
const TYPES = {
  asset:   { dir: path.join(VAULT, 'assets'),   validate: validateAsset },
  palette: { dir: path.join(VAULT, 'palettes'), validate: validatePalette },
};
type VaultType = keyof typeof TYPES;

const fail = (status: number, error: string, extra?: object) => Response.json({ error, ...extra }, { status });
const mtime = (file: string) => fs.stat(file).then((s) => String(s.mtimeMs), () => null);
const names = (dir: string) => fs.readdir(dir).catch(() => [] as string[]);
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));
const list = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(', ')} +${xs.length - 3}` : xs.join(', '));

// Which file a write or delete names: ?asset=id or ?palette=id
function target(q: URLSearchParams): { type: VaultType; id: string } | Response {
  const type = (Object.keys(TYPES) as VaultType[]).find((t) => q.has(t));
  const id = type && q.get(type);
  if (!type || !id || !SLUG.test(id)) return fail(400, `Bad vault file "${id ?? ''}"`);
  return { type, id };
}

async function usedIn(id: string): Promise<string[]> {
  const out: string[] = [];
  for (const bible of await names(DESIGN)) {
    for (const f of await names(path.join(DESIGN, bible, 'pages'))) {
      if (!f.endsWith('.json')) continue;
      const page = await readJson(path.join(DESIGN, bible, 'pages', f)).catch(() => null);
      if (page && usesAsset(page, id)) out.push(`${bible}/${f.slice(0, -5)}`);
    }
  }
  return out;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, uses = q.get('uses');
  if (uses) return Response.json({ usedIn: await usedIn(uses) });
  const t = TYPES[q.get('type') as VaultType] ?? TYPES.asset;
  const files = (await names(t.dir)).filter((f) => f.endsWith('.json') && SLUG.test(f.slice(0, -5)));
  const all = await Promise.all(files.map(async (f) => {
    const file = path.join(t.dir, f);
    // A half-written file is skipped this time; the watcher brings it back when the write finishes
    const asset = await readJson(file).catch(() => null);
    return asset && { id: f.slice(0, -5), mtime: await mtime(file), asset };
  }));
  return Response.json(all.filter(Boolean));
}

export async function PUT(req: Request) {
  const q = new URL(req.url).searchParams, at = target(q);
  if (at instanceof Response) return at;
  const { dir, validate } = TYPES[at.type];
  const body = await req.json().catch(() => undefined);
  const file = path.join(dir, `${at.id}.json`);
  const issues = validate(body);
  if (issues.errors.length) { log.refused(file, 422, issues.errors[0], issues.errors); return fail(422, issues.errors[0], issues); }

  const current = await mtime(file), base = req.headers.get('x-base-mtime');
  if (q.get('new') && current !== null) return fail(409, `"${at.id}" already exists`);   // create() tries the next name: not worth a line
  if (base !== null && current !== null && base !== current) { log.stale(file, base, current); return fail(409, 'Changed on disk since you loaded it'); }
  const before = current === null ? undefined : await readJson(file).catch(() => null);

  await fs.mkdir(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;   // write + rename: readers never see a half-written file
  await fs.writeFile(tmp, JSON.stringify(body, null, 2) + '\n');
  await fs.rename(tmp, file);
  log.saved(file, before, body, issues.warnings);
  return Response.json({ warnings: issues.warnings }, { headers: { 'x-mtime': (await mtime(file)) ?? '' } });
}

export async function DELETE(req: Request) {
  const q = new URL(req.url).searchParams, at = target(q);
  if (at instanceof Response) return at;
  const pages = at.type === 'asset' ? await usedIn(at.id) : [];
  const file = path.join(TYPES[at.type].dir, `${at.id}.json`);
  if (pages.length && !q.get('force')) { log.refused(file, 409, `delete refused: used on ${list(pages)}`); return fail(409, `Used on ${pages.length} page(s)`, { usedIn: pages }); }
  await fs.rm(file, { force: true });
  log.deleted(file, pages.length ? `(was on ${list(pages)})` : '');
  return Response.json({ usedIn: pages });
}
