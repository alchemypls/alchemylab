// A web project served as a real site, for the Live canvas and for phones on the same network: /live/<project>/<route>.
// The page is exactly the HTML export (generatePageHTML), plus three things a live view needs:
//   - links between the project's pages stay inside /live/<project>/
//   - it reloads itself when the project's file changes (the Web canvas saves to disk as you edit)
//   - its console, errors and load numbers are posted to the Live canvas when it's shown there (an iframe)

import { generatePageHTML } from './generator/page';
import { normalizePath } from './routes';
import { projectTheme, type ProjectData } from './project';

export const livePath = (pid: string, path: string) => `/live/${encodeURIComponent(pid)}${path === '/' ? '' : path}`;

// Runs in the served page. No imports, ES5-ish, so it works on any phone browser.
const LIVE_SCRIPT = (pid: string) => `
(function () {
  var inFrame = window.parent !== window;
  function post(msg) { if (inFrame) try { window.parent.postMessage(Object.assign({ alchemyLive: true, path: location.pathname }, msg), '*'); } catch (e) {} }
  function show(v) {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.stack || String(v);
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      post({ type: 'console', level: level, text: args.map(show).join(' ') });
      return orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    post({ type: 'console', level: 'error', text: (e.message || 'Error') + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : '') });
  });
  window.addEventListener('unhandledrejection', function (e) { post({ type: 'console', level: 'error', text: 'Unhandled rejection: ' + show(e.reason) }); });
  window.addEventListener('load', function () {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    post({
      type: 'load',
      ms: Math.round(nav ? nav.loadEventStart : performance.now()),
      bytes: nav && nav.transferSize ? nav.transferSize : document.documentElement.outerHTML.length,
      nodes: document.getElementsByTagName('*').length,
      behaviors: document.querySelectorAll('[data-behavior]').length,
      width: window.innerWidth, height: window.innerHeight,
    });
  });
  // Live reload: the project's file changed on disk
  if (window.EventSource) {
    var es = new EventSource('/api/projects/watch');
    es.onmessage = function (e) {
      try { if (JSON.parse(e.data).path === ${JSON.stringify(pid + '.json')}) { post({ type: 'reload' }); setTimeout(function () { location.reload(); }, 150); } } catch (x) {}
    };
  }
})();
`;

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function shell(title: string, body: string, pid: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escText(title)}</title>
<style>body{margin:0;padding:32px 20px;font:15px/1.5 system-ui,sans-serif;background:#111;color:#ddd}a{color:#a5b4fc}code{color:#fbbf24}</style></head>
<body>${body}<script>${LIVE_SCRIPT(pid)}</script></body></html>`;
}

// The page at `rawPath`, or a 404 that lists the project's pages
export function livePage(pid: string, project: ProjectData, rawPath: string): { status: number; html: string } {
  const path = normalizePath(rawPath || '/');
  const page = project.pages.find((p) => p.path === path);
  const list = `<ul>${project.pages.map((p) => `<li><a href="${livePath(pid, p.path)}">${escText(p.name)}</a> <code>${escText(p.path)}</code></li>`).join('')}</ul>`;
  if (!page) return { status: 404, html: shell('Not found', `<h1>No page at <code>${escText(path)}</code></h1><p>${escText(project.meta.name)} has:</p>${list}`, pid) };
  const layout = project.layouts[path];
  if (!layout) return { status: 200, html: shell(page.name, `<h1>${escText(page.name)}</h1><p>Nothing placed on this page yet. Place components on the Web canvas's layout layer.</p>${list}`, pid) };
  const html = generatePageHTML(page, layout, project.components ?? {}, projectTheme(project), project.meta)
    // Root-relative links to the project's own pages stay inside the live site
    .replace(/(\shref=")(\/(?!\/)[^"]*)"/g, (_m, pre: string, href: string) => `${pre}${livePath(pid, href)}"`);
  return { status: 200, html: html.replace(/<\/body>/i, `  <script>${LIVE_SCRIPT(pid)}</script>\n</body>`) };
}
