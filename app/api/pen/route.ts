// Pen bridge — Server-Sent Events stream of pen tablet samples for the Hub sketch canvas.
//
// GET /api/pen?source=local|remarkable. Per source, the first connected client spawns
// scripts/pen-bridge.py and the last to disconnect kills it. `local` exclusively grabs a USB
// tablet (released on exit); `remarkable` mirrors a Paper Pro's pen over SSH without grabbing.
// Local dev tool only: it reads hardware on the machine running `next dev`.

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Client = (line: string) => void;

interface Bridge {
  proc:    ChildProcessWithoutNullStreams | null;
  clients: Set<Client>;
  info:    string | null;  // last "info" line, replayed to late joiners
}

const SOURCES = ['local', 'remarkable'] as const;
type Source = (typeof SOURCES)[number];

// On globalThis so dev hot-reloads reuse the same child instead of orphaning a grab
const g = globalThis as typeof globalThis & { __penBridges?: Partial<Record<Source, Bridge>> };
const bridges = (g.__penBridges ??= {});

function start(bridge: Bridge, source: Source) {
  const broadcast = (line: string) => bridge.clients.forEach((send) => send(line));
  if (bridge.proc) return;
  const proc = spawn('python3', ['-u', path.join(process.cwd(), 'scripts', 'pen-bridge.py'), source]);
  bridge.proc = proc;
  let buf = '';
  proc.stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.startsWith('{"type":"info"')) bridge.info = line;
      broadcast(line);
    }
  });
  proc.stderr.on('data', (chunk: Buffer) => console.error('[pen-bridge]', chunk.toString().trim()));
  proc.on('exit', (code) => {
    if (bridge.proc !== proc) return;
    bridge.proc = null;
    bridge.info = null;
    if (code && code !== 0 && bridge.clients.size) {
      broadcast(JSON.stringify({ type: 'closed', code }));
    }
  });
  proc.on('error', (err) => {
    broadcast(JSON.stringify({ type: 'error', code: 'SPAWN', message: `Could not start python3: ${err.message}` }));
  });
}

function stop(bridge: Bridge) {
  bridge.proc?.kill('SIGTERM');   // exit closes the fd → kernel releases EVIOCGRAB
  bridge.proc = null;
  bridge.info = null;
}

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('source') ?? 'local';
  if (!(SOURCES as readonly string[]).includes(requested)) {
    const msg = JSON.stringify({ type: 'error', code: 'SOURCE', message: `Unknown pen source "${requested}" — reload the page` });
    return new Response(`data: ${msg}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
  }
  const source = requested as Source;
  const bridge = (bridges[source] ??= { proc: null, clients: new Set(), info: null });
  const encoder = new TextEncoder();
  let client: Client | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      client = (line) => {
        try { controller.enqueue(encoder.encode(`data: ${line}\n\n`)); } catch { /* closed */ }
      };
      bridge.clients.add(client);
      if (bridge.info) client(bridge.info);
      start(bridge, source);

      req.signal.addEventListener('abort', () => {
        if (client) bridge.clients.delete(client);
        if (bridge.clients.size === 0) stop(bridge);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      if (client) bridge.clients.delete(client);
      if (bridge.clients.size === 0) stop(bridge);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection:      'keep-alive',
    },
  });
}
