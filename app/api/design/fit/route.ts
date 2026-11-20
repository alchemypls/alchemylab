// Fit report from the Ideation canvas: PUT /api/design/fit?bible=x&page=y, body FitReport.
// Merged into design/<bible>/.render.json — how the agent learns whether a page fits without seeing it.
// Reports arrive close together (several pages, two tabs): merges run one at a time per file and land by rename,
// so one never writes over another half-way.

import { promises as fs } from 'fs';
import path from 'path';
import { SLUG } from '@/lib/design/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const queues = new Map<string, Promise<unknown>>();

export async function PUT(req: Request) {
  const q = new URL(req.url).searchParams;
  const bible = q.get('bible'), page = q.get('page');
  if (!bible || !page || !SLUG.test(bible) || !SLUG.test(page)) return Response.json({ error: 'bible and page required' }, { status: 400 });
  const file = path.join(process.cwd(), 'design', bible, '.render.json');
  const report = await req.json();
  const run = (queues.get(file) ?? Promise.resolve()).then(async () => {
    const reports = await fs.readFile(file, 'utf8').then(JSON.parse, () => ({}));
    reports[page] = report;
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(reports, null, 2) + '\n');
    await fs.rename(tmp, file);
  });
  queues.set(file, run.catch(() => {}));
  await run;
  return new Response(null, { status: 204 });
}
