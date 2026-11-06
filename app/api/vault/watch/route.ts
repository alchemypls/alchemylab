// Vault watch — SSE: one `{ path }` message per changed file under vault/.

import path from 'path';
import { watchFolder } from '@/lib/server/fileWatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return watchFolder(req, path.join(process.cwd(), 'vault'));
}
