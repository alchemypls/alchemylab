// Fit report from the Ideation canvas: PUT /api/design/fit?bible=x&page=y, body FitReport.
// Merged into design/<bible>/.render.json — how the agent learns whether a page fits without seeing it.

import { promises as fs } from 'fs';
import path from 'path';
import { SLUG } from '@/lib/design/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const q = new URL(req.url).searchParams;
  const bible = q.get('bible'), page = q.get('page');
  if (!bible || !page || !SLUG.test(bible) || !SLUG.test(page)) return Response.json({ error: 'bible and page required' }, { status: 400 });
  const file = path.join(process.cwd(), 'design', bible, '.render.json');
  const reports = await fs.readFile(file, 'utf8').then(JSON.parse, () => ({}));
  reports[page] = await req.json();
  await fs.writeFile(file, JSON.stringify(reports, null, 2) + '\n');
  return new Response(null, { status: 204 });
}
