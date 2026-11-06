// Projects watch — SSE: one `{ path }` message per changed file under projects/ (the Web canvas and every /live page listen).

import { watchFolder } from '@/lib/server/fileWatch';
import { PROJECTS_DIR } from '@/lib/server/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return watchFolder(req, PROJECTS_DIR, (base) => base.endsWith('.tmp'));
}
