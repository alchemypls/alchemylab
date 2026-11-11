// Server-Sent Events for a folder: one `{ path }` message per changed file.
// One fs.watch per folder, shared by all clients (on globalThis so dev hot-reloads don't stack watchers).

import { watch, mkdirSync, statSync, FSWatcher } from 'fs';
import path from 'path';
import { log } from './log';

const DEBOUNCE_MS = 120; // editors/agents often write a file in several chunks

type Client = (line: string) => void;
type Hub = { watcher: FSWatcher | null; clients: Set<Client>; ino?: number };
const g = globalThis as typeof globalThis & { __fileWatch?: Map<string, Hub> };
const hubs = (g.__fileWatch ??= new Map());

function start(root: string, hub: Hub, skip?: (base: string) => boolean) {
  mkdirSync(root, { recursive: true });
  // A watch stays on the folder it started on. If that folder was removed and recreated, start over.
  const ino = statSync(root).ino;
  if (hub.watcher && hub.ino === ino) return;
  hub.watcher?.close();
  hub.ino = ino;
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  hub.watcher = watch(root, { recursive: true }, (_event, file) => {
    if (!file || skip?.(path.basename(file))) return;
    clearTimeout(pending.get(file));
    pending.set(file, setTimeout(() => {
      pending.delete(file);
      if (!file.endsWith('.tmp')) log.changed(path.join(root, file));   // the server's own writes are skipped there
      const line = JSON.stringify({ path: file });
      hub.clients.forEach((send) => send(line));
    }, DEBOUNCE_MS));
  });
}

export function watchFolder(req: Request, root: string, skip?: (base: string) => boolean): Response {
  const hub: Hub = hubs.get(root) ?? { watcher: null, clients: new Set() };
  hubs.set(root, hub);
  const encoder = new TextEncoder();
  let client: Client | null = null;
  const drop = () => {
    if (client) hub.clients.delete(client);
    if (hub.clients.size === 0) { hub.watcher?.close(); hub.watcher = null; }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      client = (line) => {
        try { controller.enqueue(encoder.encode(`data: ${line}\n\n`)); } catch { /* closed */ }
      };
      hub.clients.add(client);
      start(root, hub, skip);
      req.signal.addEventListener('abort', () => {
        drop();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel: drop,
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection:      'keep-alive',
    },
  });
}
