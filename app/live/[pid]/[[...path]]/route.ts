// /live/<project>/<route…>: the project's page as a browser gets it (lib/live.ts). Served on every interface the dev
// server listens on, so a phone on the same network can open it. Local dev tool only.

import { SLUG } from '@/lib/design/types';
import { livePage } from '@/lib/live';
import { readProject } from '@/lib/server/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { pid: string; path?: string[] } }) {
  const pid = decodeURIComponent(params.pid);
  const found = SLUG.test(pid) ? await readProject(pid) : null;
  if (!found) return new Response(`No project "${pid}"`, { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { status, html } = livePage(pid, found.project, '/' + (params.path ?? []).map(decodeURIComponent).join('/'));
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
