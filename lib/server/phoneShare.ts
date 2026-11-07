// Sharing Live pages with a phone on the same network, without opening the app to it.
// The app listens on 127.0.0.1 only. While sharing is on, a small gateway on every interface (the app's port + 1)
// passes on just what a phone needs to view a page: GET /live/… and the live-reload stream. Saves, deletes, the
// API and the canvases aren't reachable through it, whatever the request says. It turns itself off after 30 minutes.

import http from 'http';
import type { Socket } from 'net';

// What the gateway passes on: viewing a Live page and its live-reload stream, nothing else
export const shareable = (url: string) => {
  let path: string;
  try { path = decodeURIComponent(url.split('?')[0]); } catch { return false; }
  if (path.includes('..') || path.includes('\\')) return false;   // no stepping out of /live/
  return path.startsWith('/live/') || path === '/api/projects/watch';
};
const MAX_ON_MS = 30 * 60 * 1000;

interface Share { server: http.Server; port: number; until: number; sockets: Set<Socket>; timer: NodeJS.Timeout }
// Kept on globalThis: the dev server reloads this module on edits, and a second gateway can't take the same port
const g = globalThis as { __alchemyShare?: Share | null };

export const shareState = () => (g.__alchemyShare ? { port: g.__alchemyShare.port, until: g.__alchemyShare.until } : null);

export function startShare(appPort: number): Promise<{ port: number; until: number }> {
  if (g.__alchemyShare) return Promise.resolve(shareState()!);
  const port = appPort + 1, sockets = new Set<Socket>();
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !shareable(url)) {
      res.writeHead(403, { 'content-type': 'text/plain' }).end('Only Live pages are shared.');
      return;
    }
    const up = http.request({ host: '127.0.0.1', port: appPort, path: url, method: req.method, headers: { accept: req.headers.accept ?? '*/*', host: `127.0.0.1:${appPort}` } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on('error', () => { if (!res.headersSent) res.writeHead(502).end('Alchemy is not answering.'); });
    req.on('close', () => up.destroy());   // the phone left: drop its live-reload stream too
    up.end();
  });
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return new Promise((resolve, reject) => {
    server.once('error', (e) => reject(e));
    server.listen(port, '0.0.0.0', () => {
      const until = Date.now() + MAX_ON_MS;
      g.__alchemyShare = { server, port, until, sockets, timer: setTimeout(stopShare, MAX_ON_MS) };
      resolve({ port, until });
    });
  });
}

export function stopShare() {
  const s = g.__alchemyShare;
  if (!s) return;
  g.__alchemyShare = null;
  clearTimeout(s.timer);
  s.server.close();
  s.sockets.forEach((k) => k.destroy());   // open live-reload streams would keep it alive
}
