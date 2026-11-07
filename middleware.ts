// Alchemy is a local tool: its API reads and writes files on this computer and has no login. Requests have to be
// addressed to this computer (localhost), so a web page can't reach it under another name (DNS rebinding) and a
// deployed copy refuses to work instead of letting anyone edit its files. The app itself only listens on 127.0.0.1
// (package.json); phones get Live pages through the read-only gateway (lib/server/phoneShare.ts).

import { NextResponse, type NextRequest } from 'next/server';

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').replace(/:\d+$/, '').toLowerCase();
  if (LOCAL.has(host)) return NextResponse.next();
  return NextResponse.json({ error: 'Alchemy is a local tool: open it at http://localhost on the computer running it.' }, { status: 403 });
}

export const config = { matcher: ['/api/:path*', '/live/:path*'] };
