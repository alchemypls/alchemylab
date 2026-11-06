"use client";

import { useMemo, useState } from 'react';
import { generatePageHTML, generatePageTSX } from '@/lib/generator/page';
import { projectTheme, type PageDef, type PageLayout, type ProjectData } from '@/lib/project';

// The Web canvas's output, in the box under the minimap: this page as a plain HTML file (opens in any browser as is)
// or as a Next.js page. Copy it, download it, or open the HTML in a new tab to try it at real sizes.

type Format = 'html' | 'next';
const FORMAT_KEY = 'web:codeFormat';
const BTN = 'text-[10px] font-mono px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30';

const fileSlug = (page: PageDef) => (page.path === '/' ? 'index' : page.path.replace(/^\/|\/$/g, '').replace(/[^a-zA-Z0-9-]+/g, '-')) || 'page';

export function pageOutput(format: Format, project: ProjectData, page: PageDef, layout: PageLayout) {
  const gen = format === 'html' ? generatePageHTML : generatePageTSX;
  return gen(page, layout, project.components ?? {}, projectTheme(project), project.meta);
}

export function CodeBox({ project, page, layout }: { project: ProjectData; page: PageDef; layout: PageLayout | undefined }) {
  const [format, setFormatState] = useState<Format>(() => { try { return localStorage.getItem(FORMAT_KEY) === 'next' ? 'next' : 'html'; } catch { return 'html'; } });
  const setFormat = (f: Format) => { setFormatState(f); try { localStorage.setItem(FORMAT_KEY, f); } catch { /* per-browser convenience */ } };
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => (layout ? pageOutput(format, project, page, layout) : ''), [format, project, page, layout]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: format === 'html' ? 'text/html' : 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = format === 'html' ? `${fileSlug(page)}.html` : 'page.tsx';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const open = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const copy = () => { navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  return (
    <div className="p-3 flex flex-col gap-2 text-xs text-neutral-300">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-sky-400">Output</span>
        <span className="flex-1" />
        <div className="flex rounded-full overflow-hidden border border-neutral-700 text-[10px] font-mono">
          {(['html', 'next'] as const).map((f) => (
            <button key={f} aria-pressed={format === f} onClick={() => setFormat(f)} title={f === 'html' ? 'One HTML file: opens in any browser, no build step' : 'A Next.js app/<route>/page.tsx'}
              className={`px-2 py-0.5 ${format === f ? 'bg-amber-500/25 text-amber-300' : 'text-neutral-400 hover:text-neutral-200'}`}>{f === 'html' ? 'HTML' : 'Next.js'}</button>
          ))}
        </div>
      </div>
      {!layout ? (
        <p className="text-[10px] text-neutral-500">Nothing placed on this page yet. Place components on the layout layer (2) first.</p>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <button className={BTN} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            <button className={BTN} onClick={download} title={format === 'html' ? `${fileSlug(page)}.html` : 'page.tsx, for app' + (page.path === '/' ? '/' : `${page.path}/`)}>Download</button>
            {format === 'html' && <button className={BTN} onClick={open} title="Open this page in a new tab, as a browser gets it">Open in tab ↗</button>}
            <span className="flex-1" />
            <span className="text-[9px] font-mono text-neutral-500">{(code.length / 1024).toFixed(1)} KB</span>
          </div>
          <pre className="max-h-[50vh] overflow-auto rounded bg-neutral-950/80 border border-neutral-800 p-2 text-[9px] leading-snug font-mono text-neutral-300 whitespace-pre">{code}</pre>
        </>
      )}
    </div>
  );
}
