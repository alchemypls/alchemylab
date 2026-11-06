// The addresses a phone on the same network can reach this dev server at: { hosts: ["192.168.1.20", …], port }.

import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  // Skips container and VM bridges (docker0, br-…, veth…, virbr…): a phone can't reach those
  const hosts = Object.entries(os.networkInterfaces())
    .filter(([name]) => !/^(docker|br-|veth|virbr|vmnet|vboxnet)/.test(name))
    .flatMap(([, addrs]) => addrs ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  const port = new URL(req.url).port || (req.headers.get('host') ?? '').split(':')[1] || '3000';
  return Response.json({ hosts, port });
}
