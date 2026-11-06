// Design bible watch — SSE: one `{ path }` message per changed file under design/.
// .render.json is skipped: the canvas writes it, and echoing it back would loop.

import path from 'path';
import { watchFolder } from '@/lib/server/fileWatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return watchFolder(req, path.join(process.cwd(), 'design'), (base) => base === '.render.json');
}
