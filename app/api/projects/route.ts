// Web projects on disk: projects/<id>.json, one ProjectData per file. The Web canvas reads and writes them through
// lib/projectSync.ts; the Live canvas and /live/<id>/… serve them; the agent can read and edit them directly. Local dev tool only.
//
//   GET    /api/projects          → [{ id, mtime, project }]
//   GET    /api/projects?id=x     → { id, mtime, project } (404 if missing)
//   PUT    /api/projects?id=x     → write it. Send x-base-mtime = the mtime you edited from: if the file changed since, 409.
//   DELETE /api/projects?id=x     → remove it

import { promises as fs } from 'fs';
import path from 'path';
import { SLUG } from '@/lib/design/types';
import { PROJECTS_DIR, readProject, validateProject } from '@/lib/server/projects';
import { log } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (status: number, error: string) => Response.json({ error }, { status });
const mtime = (file: string) => fs.stat(file).then((s) => String(s.mtimeMs), () => null);
const fileOf = (id: string) => path.join(PROJECTS_DIR, `${id}.json`);
const idOf = (q: URLSearchParams) => { const id = q.get('id'); return id && SLUG.test(id) ? id : null; };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.has('id')) {
    const id = idOf(q);
    if (!id) return fail(400, 'Bad project id');
    const one = await readProject(id);
    return one ? Response.json(one) : fail(404, `No project "${id}"`);
  }
  const files = (await fs.readdir(PROJECTS_DIR).catch(() => [] as string[])).filter((f) => f.endsWith('.json') && SLUG.test(f.slice(0, -5)));
  const all = await Promise.all(files.map((f) => readProject(f.slice(0, -5))));
  return Response.json(all.filter(Boolean));
}

export async function PUT(req: Request) {
  const id = idOf(new URL(req.url).searchParams);
  if (!id) return fail(400, 'Bad project id');
  const body = await req.json().catch(() => undefined);
  const error = validateProject(body), file = fileOf(id);
  if (error) { log.refused(file, 422, error); return fail(422, error); }
  const current = await mtime(file), base = req.headers.get('x-base-mtime');
  if (base && current !== null && base !== current) { log.stale(file, base, current); return fail(409, 'Changed on disk since you loaded it'); }
  const before = current === null ? undefined : (await readProject(id))?.project ?? null;
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;   // write + rename: readers never see a half-written file
  await fs.writeFile(tmp, JSON.stringify(body, null, 2) + '\n');
  await fs.rename(tmp, file);
  log.saved(file, before, body);
  return new Response(null, { status: 204, headers: { 'x-mtime': (await mtime(file)) ?? '' } });
}

export async function DELETE(req: Request) {
  const id = idOf(new URL(req.url).searchParams);
  if (!id) return fail(400, 'Bad project id');
  await fs.rm(fileOf(id), { force: true });
  log.deleted(fileOf(id));
  return new Response(null, { status: 204 });
}
