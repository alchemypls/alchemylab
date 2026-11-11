// Design bible files — shared by the Ideation canvas (read + hand edits) and the agent (writes files directly).
//
//   GET /api/design                        → BibleSummary[]
//   GET /api/design?bible=x                → bible.json        (x-mtime header)
//   GET /api/design?bible=x&page=y         → pages/y.json      (x-mtime header)
//   GET /api/design?bible=x&asset=file.png → assets/file.png
//   PUT /api/design?bible=x[&page=y]       → write bible.json / pages/y.json
//       Validated (422 + issues on errors). Send x-base-mtime = the x-mtime you edited from:
//       if the file changed since (the agent wrote it), 409 — reload instead of clobbering.
//   PUT /api/design?bible=x&asset=file.png → store the raw body in assets/ (image types only)
//
// Fit reports go to /api/design/fit. Local dev tool only: reads and writes the repo's design/ folder.

import { promises as fs } from 'fs';
import path from 'path';
import { SLUG, type BibleSummary } from '@/lib/design/types';
import { validateBible, validatePage, type BibleContext } from '@/lib/design/validate';
import { log } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = path.join(process.cwd(), 'design');

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

const MAX_ASSET_BYTES = 20 * 1024 * 1024;

const fail = (status: number, error: string, extra?: object) => Response.json({ error, ...extra }, { status });

async function readJson(file: string) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

const mtime = (file: string) => fs.stat(file).then((s) => String(s.mtimeMs), () => null);
const names = (dir: string) => fs.readdir(dir).catch(() => [] as string[]);

async function context(dir: string): Promise<BibleContext> {
  const bible = await readJson(path.join(dir, 'bible.json')).catch(() => null);
  return {
    pages:  (await names(path.join(dir, 'pages'))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
    assets: await names(path.join(dir, 'assets')),
    topics: bible?.topics?.map((t: { id: string }) => t.id),
    vault:  (await names(path.join(process.cwd(), 'vault', 'assets'))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
  };
}

async function list(): Promise<BibleSummary[]> {
  const dirs = await fs.readdir(ROOT, { withFileTypes: true }).catch(() => []);
  const out: BibleSummary[] = [];
  for (const d of dirs) {
    if (!d.isDirectory() || !SLUG.test(d.name)) continue;
    const dir = path.join(ROOT, d.name);
    const bible = await readJson(path.join(dir, 'bible.json')).catch(() => null);
    if (!bible) continue;
    const pages = await Promise.all((await context(dir)).pages.map(async (id) => {
      const page = await readJson(path.join(dir, 'pages', `${id}.json`)).catch(() => null);
      return { id, title: page?.title ?? id };
    }));
    pages.sort((a, b) => (a.id === 'index' ? -1 : b.id === 'index' ? 1 : a.title.localeCompare(b.title)));
    out.push({ id: d.name, title: bible.title ?? d.name, pages });
  }
  return out;
}

// bible + optional page from the query → the file they name, or an error response
function target(q: URLSearchParams): { dir: string; file: string; page: string | null } | Response {
  const bible = q.get('bible'), page = q.get('page');
  if (!bible || !SLUG.test(bible)) return fail(400, `Bad bible id "${bible}"`);
  if (page && !SLUG.test(page)) return fail(400, `Bad page id "${page}"`);
  const dir = path.join(ROOT, bible);
  return { dir, page, file: page ? path.join(dir, 'pages', `${page}.json`) : path.join(dir, 'bible.json') };
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!q.get('bible')) return Response.json(await list());
  const t = target(q);
  if (t instanceof Response) return t;

  const asset = q.get('asset');
  if (asset) {
    if (asset !== path.basename(asset)) return fail(400, 'Bad asset name');
    const bytes = await fs.readFile(path.join(t.dir, 'assets', asset)).catch(() => null);
    if (!bytes) return fail(404, `No asset ${asset}`);
    return new Response(bytes, { headers: { 'Content-Type': MIME[path.extname(asset).toLowerCase()] ?? 'application/octet-stream' } });
  }

  try {
    const [body, m] = await Promise.all([readJson(t.file), mtime(t.file)]);
    return Response.json(body, { headers: { 'x-mtime': m ?? '' } });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    return err.code === 'ENOENT'
      ? fail(404, t.page ? `Page "${t.page}" not built yet` : `No bible "${q.get('bible')}"`)
      : fail(422, `${path.relative(ROOT, t.file)}: ${err.message}`);  // half-written / invalid JSON
  }
}

export async function PUT(req: Request) {
  const q = new URL(req.url).searchParams;
  const t = target(q);
  if (t instanceof Response) return t;

  const asset = q.get('asset');
  if (asset) {
    if (asset !== path.basename(asset) || asset.startsWith('.') || !MIME[path.extname(asset).toLowerCase()]) return fail(400, `Bad image name "${asset}"`);
    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length > MAX_ASSET_BYTES) return fail(413, 'Image is over 20 MB');
    await fs.mkdir(path.join(t.dir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(t.dir, 'assets', asset), bytes);
    log.uploaded(path.join(t.dir, 'assets', asset), bytes.length);
    return Response.json({ src: asset });
  }

  const body = await req.json().catch(() => undefined);
  const ctx = await context(t.dir);
  const issues = t.page ? validatePage(body, ctx) : validateBible(body, ctx);
  if (issues.errors.length) { log.refused(t.file, 422, issues.errors[0], issues.errors); return fail(422, issues.errors[0], issues); }

  const base = req.headers.get('x-base-mtime');
  const current = await mtime(t.file);
  if (base !== null && current !== null && base !== current) { log.stale(t.file, base, current); return fail(409, 'Changed on disk since you loaded it'); }
  const before = current === null ? undefined : await readJson(t.file).catch(() => null);

  await fs.mkdir(path.dirname(t.file), { recursive: true });
  const tmp = `${t.file}.${process.pid}.tmp`;   // write + rename: readers never see a half-written file
  await fs.writeFile(tmp, JSON.stringify(body, null, 2) + '\n');
  await fs.rename(tmp, t.file);
  log.saved(t.file, before, body, issues.warnings);
  return Response.json({ warnings: issues.warnings }, { headers: { 'x-mtime': (await mtime(t.file)) ?? '' } });
}
