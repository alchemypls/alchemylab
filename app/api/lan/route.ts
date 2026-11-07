// Sharing Live pages with a phone on the same network (lib/server/phoneShare.ts).
//   GET /api/lan              → { hosts: ["192.168.1.20", …], sharing: { port, until } | null }
//   PUT /api/lan {on: bool}   → turn the read-only gateway on or off; same answer

import os from 'os';
import { shareState, startShare, stopShare } from '@/lib/server/phoneShare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Skips container and VM bridges (docker0, br-…, veth…, virbr…): a phone can't reach those
const hosts = () => Object.entries(os.networkInterfaces())
  .filter(([name]) => !/^(docker|br-|veth|virbr|vmnet|vboxnet)/.test(name))
  .flatMap(([, addrs]) => addrs ?? [])
  .filter((a) => a.family === 'IPv4' && !a.internal)
  .map((a) => a.address);

export function GET() {
  return Response.json({ hosts: hosts(), sharing: shareState() });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.on) { stopShare(); return Response.json({ hosts: hosts(), sharing: null }); }
  const appPort = Number(new URL(req.url).port || (req.headers.get('host') ?? '').split(':')[1] || 3000);
  try {
    return Response.json({ hosts: hosts(), sharing: await startShare(appPort) });
  } catch (e) {
    const busy = (e as NodeJS.ErrnoException).code === 'EADDRINUSE';
    return Response.json({ error: busy ? `Port ${appPort + 1} is in use` : (e as Error).message }, { status: 500 });
  }
}
