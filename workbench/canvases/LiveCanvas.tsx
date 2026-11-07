"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import { useCurrentProject } from '@/workbench/hooks/useCurrentProject';
import { useSheetView } from '@/workbench/hooks/useSheetView';
import { PANEL_SELECT as SELECT, MAP_RAIL, PanelToggle, SheetPanel } from '@/workbench/ui/SheetPanel';
import { DeviceBar } from '@/workbench/ui/DeviceBar';
import { Sheet, SheetSurface } from '@/workbench/ui/SheetShell';
import { DEVICES, TIER_DEFAULT_DEVICE, TIER_ORDER, TIERS, tierOf, type Tier, type ViewportSize } from '@/lib/devices';
import { livePath } from '@/lib/live';
import { liveChecks, type CheckLevel } from '@/lib/liveChecks';

// Live: the Web canvas's project running for real. The page is the HTML export served at /live/<project>/<route>,
// shown in a frame at a device's size, reloading itself whenever the project is saved (the Web canvas saves as you
// edit). Like browser dev tools: watch its console, see its numbers, read the checks, open it on a phone.
// Devices are this canvas's layers: one per tier (1 phone, 2 tablet, 3 desktop; pips left of the minimap; Ctrl + wheel).

type Box = 'console' | 'checks' | 'phone';
type LogLine = { id: number; level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'reload'; text: string; path: string; at: number };
type Stats = { ms: number; bytes: number; nodes: number; behaviors: number; width: number; height: number; path: string };

const DEVICES_KEY = 'live:devices', TIER_KEY = 'live:tier';
const MAX_LINES = 500;
const TIER_GLYPH: Record<Tier, string> = { mobile: 'phone', tablet: 'tablet', desktop: 'desktop' };

function presetFor(t: Tier): ViewportSize {
  const d = DEVICES.find((x) => x.id === TIER_DEFAULT_DEVICE[t])!;
  return { deviceId: d.id, width: d.width, height: d.height };
}
function readDevices(): Record<Tier, ViewportSize> {
  const base = { mobile: presetFor('mobile'), tablet: presetFor('tablet'), desktop: presetFor('desktop') };
  try { return { ...base, ...JSON.parse(localStorage.getItem(DEVICES_KEY) ?? '{}') }; } catch { return base; }
}
function readTier(): Tier {
  try { const t = localStorage.getItem(TIER_KEY); return TIER_ORDER.includes(t as Tier) ? (t as Tier) : 'mobile'; } catch { return 'mobile'; }
}
const remember = (key: string, v: unknown) => { try { localStorage.setItem(key, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* per-browser convenience */ } };

export function LiveCanvas() {
  const active        = useWorkbenchStore((s) => s.activeScene === 'rnd');
  const projects      = useWorkbenchStore((s) => s.projects);
  const touchProject  = useWorkbenchStore((s) => s.touchProject);
  const setActivePage = useWorkbenchStore((s) => s.setActivePage);
  const { pid, project } = useCurrentProject();
  const page = project.pages.find((p) => p.path === project.activePath) ?? project.pages[0];
  const path = page?.path ?? '/';

  const [devices, setDevices] = useState(readDevices);
  const [tier, setTierState] = useState<Tier>(readTier);
  const device = devices[tier];
  const setTier = (t: Tier) => { setTierState(t); remember(TIER_KEY, t); };
  const setDevice = (v: ViewportSize) => {
    // A size of another tier moves to that tier's pip, so each pip keeps a device of its own tier
    const t = tierOf(v.width), next = { ...devices, [t]: v };
    setDevices(next); remember(DEVICES_KEY, next); if (t !== tier) setTier(t);
  };
  const stepTier = (d: 1 | -1) => { const t = TIER_ORDER[TIER_ORDER.indexOf(tier) - d]; if (t) setTier(t); };   // wheel up = a bigger device

  const [box, setBox] = useState<Box | null>('console');
  const toggle = (b: Box) => () => setBox(box === b ? null : b);
  const frame = useRef<HTMLIFrameElement>(null);
  const reload = () => { try { frame.current?.contentWindow?.location.reload(); } catch { /* cross-origin: never, it's ours */ } };
  const src = livePath(pid, path);

  // The frame's console, errors, reloads and load numbers (posted by the script /live adds to the page)
  const [lines, setLines] = useState<LogLine[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.alchemyLive) return;
      const m = e.data as { type: string; level?: LogLine['level']; text?: string; path: string } & Partial<Stats>;
      const route = m.path.replace(/^\/live\/[^/]+/, '') || '/';
      if (m.type === 'console' || m.type === 'reload') {
        const line: LogLine = { id: ++seq.current, level: m.type === 'reload' ? 'reload' : m.level ?? 'log', text: m.type === 'reload' ? 'Project saved: reloading' : m.text ?? '', path: route, at: Date.now() };
        setLines((ls) => [...ls.slice(-(MAX_LINES - 1)), line]);
      } else if (m.type === 'load') {
        setStats({ ms: m.ms ?? 0, bytes: m.bytes ?? 0, nodes: m.nodes ?? 0, behaviors: m.behaviors ?? 0, width: m.width ?? 0, height: m.height ?? 0, path: route });
        // Following a link inside the page opens that page everywhere (Web follows it too)
        if (route !== path && project.pages.some((p) => p.path === route)) setActivePage(pid, route);
      }
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [pid, path, project.pages, setActivePage]);
  const errors = lines.filter((l) => l.level === 'error').length, warns = lines.filter((l) => l.level === 'warn').length;

  const checks = useMemo(() => liveChecks(project), [project]);
  const problems = checks.filter((c) => c.level !== 'info').length;

  const sheet = { width: device.width, height: device.height };
  const sv = useSheetView({
    sheet, active, panOnDrag: false,
    onKey: (e) => {   // 1, 2, 3: phone, tablet, desktop; R reloads
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0) { e.preventDefault(); setTier(TIER_ORDER[i]); }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); reload(); }
    },
    onCtrlWheel: stepTier,
  });
  const { view, fit } = sv;
  useEffect(() => { fit(); }, [tier, device.width, device.height, fit]);

  return (
    <div className="absolute inset-0 bg-[#141312]">
      <SheetSurface sv={sv} grab={false}>
        <Sheet sv={sv} size={device} className="rounded-[6px] overflow-hidden" style={{ boxShadow: '0 0 0 1px #3f3f46, 0 10px 40px rgba(0,0,0,0.6)', background: '#fff' }}>
          {project.pages.length ? (
            <iframe ref={frame} key={pid} src={src} title="Live page" className="block border-0" style={{ width: device.width, height: device.height }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-500 text-sm p-8 text-center">This project has no pages yet. Add one on the Web canvas.</div>
          )}
          {/* While space is held the frame can't swallow the drag, so the view pans */}
          {sv.spaceHeld && <div className="absolute inset-0" />}
        </Sheet>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-[10px] font-mono text-neutral-500 pointer-events-none">
          {device.width} × {device.height} · {Math.round(view.scale * 100)}%{stats ? ` · loaded in ${stats.ms} ms` : ''}
        </div>
      </SheetSurface>

      {active && (
        <SheetPanel
          sv={sv} page={null}
          pickers={
            <>
              <select value={pid} className={SELECT} title="Project" onChange={(e) => { touchProject(e.target.value); e.target.blur(); }}>
                {Object.values(projects).map((p) => <option key={p.meta.id} value={p.meta.id} className="bg-neutral-900">{p.meta.name}</option>)}
              </select>
              <select value={path} className={SELECT} title="Page" onChange={(e) => { setActivePage(pid, e.target.value); e.target.blur(); }}>
                {!page && <option value="/">—</option>}
                {project.pages.map((p) => <option key={p.path} value={p.path} className="bg-neutral-900">{p.name} · {p.path}</option>)}
              </select>
            </>
          }
          row={<DeviceBar compact value={device} onChange={setDevice} className="px-0.5" />}
          status={<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${errors ? 'bg-red-500' : 'bg-emerald-500'}`} title={errors ? `${errors} error(s) in the console` : 'Live: reloads when the project is saved'} />}
          controls={
            <>
              <PanelToggle onClick={reload} title="Reload the page (R)">↻ reload</PanelToggle>
              <PanelToggle onClick={() => window.open(src, '_blank', 'noopener')} title="Open this page in its own tab">tab ↗</PanelToggle>
            </>
          }
          map={<LiveMap device={device} sv={sv} />}
          rail={<TierPips tier={tier} devices={devices} setTier={setTier} />}
          panels={
            <>
              <PanelToggle on={box === 'console'} onClick={toggle('console')} title="The page's console: logs, warnings, errors, reloads">
                console{errors ? <span className="text-red-400"> {errors}</span> : warns ? <span className="text-amber-400"> {warns}</span> : null}
              </PanelToggle>
              <PanelToggle on={box === 'checks'} onClick={toggle('checks')} title="Problems across the project's pages: broken links, overlaps, missing text">
                checks{problems ? <span className="text-amber-400"> {problems}</span> : null}
              </PanelToggle>
              <PanelToggle on={box === 'phone'} onClick={toggle('phone')} title="Open this page on a phone on the same network">phone</PanelToggle>
            </>
          }
          below={
            box === 'console' ? <ConsoleBox lines={lines} stats={stats} clear={() => setLines([])} />
            : box === 'checks' ? <ChecksBox checks={checks} open={(p) => p && setActivePage(pid, p)} />
            : box === 'phone' ? <PhoneBox path={src} />
            : undefined
          }
        />
      )}
    </div>
  );
}

// Left of the minimap: one pip per device tier, the biggest on top
function TierPips({ tier, devices, setTier }: { tier: Tier; devices: Record<Tier, ViewportSize>; setTier: (t: Tier) => void }) {
  return (
    <div className={MAP_RAIL}>
      {[...TIER_ORDER].reverse().map((t) => {
        const i = TIER_ORDER.indexOf(t), d = devices[t];
        return (
          <button key={t} className="group p-1" aria-pressed={tier === t} aria-label={TIER_GLYPH[t]} onClick={() => setTier(t)}
            title={`${TIERS.find((x) => x.id === t)!.label} (${i + 1}, Ctrl + wheel): ${DEVICES.find((x) => x.id === d.deviceId)?.name ?? 'Custom'} ${d.width}×${d.height}`}>
            <span className={`block w-2 h-2 rounded-full transition-colors ${tier === t ? 'bg-amber-400' : 'bg-neutral-500 group-hover:bg-neutral-300'}`} />
          </button>
        );
      })}
    </div>
  );
}

// The device small, with the part on screen. Click or drag to move the view.
function LiveMap({ device, sv }: { device: ViewportSize; sv: ReturnType<typeof useSheetView> }) {
  const W = device.width, H = device.height, v = sv.visible;
  const showsAll = v.x <= 0 && v.y <= 0 && v.x + v.w >= W && v.y + v.h >= H;
  const center = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    sv.centerOn(((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height);
  };
  return (
    <div className="flex justify-center bg-neutral-950/60 rounded-lg" style={{ height: 120 }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full cursor-pointer" style={{ aspectRatio: `${W} / ${H}`, maxWidth: '100%' }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); center(e); }} onPointerMove={(e) => { if (e.buttons === 1) center(e); }}>
        <rect width={W} height={H} rx={W / 30} fill="#27272a" stroke="#52525b" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {!showsAll && <rect x={v.x} y={v.y} width={v.w} height={v.h} fill="#6366f1" fillOpacity={0.12} stroke="#6366f1" vectorEffect="non-scaling-stroke" strokeWidth={1.5} />}
      </svg>
    </div>
  );
}

const LEVEL_STYLE: Record<LogLine['level'], string> = {
  log: 'text-neutral-300', info: 'text-sky-300', debug: 'text-neutral-500', warn: 'text-amber-300 bg-amber-500/5', error: 'text-red-300 bg-red-500/10', reload: 'text-indigo-300/80 italic',
};

function ConsoleBox({ lines, stats, clear }: { lines: LogLine[]; stats: Stats | null; clear: () => void }) {
  const [filter, setFilter] = useState<'all' | 'warn' | 'error'>('all');
  const end = useRef<HTMLDivElement>(null);
  const shown = lines.filter((l) => filter === 'all' || l.level === filter || (filter === 'warn' && l.level === 'error'));
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [shown.length]);
  return (
    <div className="flex flex-col text-[10px] font-mono">
      {stats && (
        <div className="grid grid-cols-3 gap-px bg-neutral-800 border-b border-neutral-800">
          {[['load', `${stats.ms} ms`], ['size', `${(stats.bytes / 1024).toFixed(1)} KB`], ['elements', stats.nodes], ['behaviors', stats.behaviors], ['window', `${stats.width}×${stats.height}`], ['page', stats.path]].map(([k, v]) => (
            <div key={k} className="bg-neutral-900 px-2 py-1.5"><div className="text-[8px] uppercase tracking-widest text-neutral-500">{k}</div><div className="text-neutral-200 truncate">{v}</div></div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-neutral-800">
        {(['all', 'warn', 'error'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-1.5 rounded ${filter === f ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>{f === 'all' ? 'all' : f === 'warn' ? 'warnings' : 'errors'}</button>
        ))}
        <span className="flex-1" />
        <button onClick={clear} className="text-neutral-500 hover:text-neutral-300" title="Clear the console">clear</button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto">
        {shown.length === 0 && <p className="px-2 py-3 text-neutral-600">Nothing logged yet. The page&apos;s console.log, warnings and errors show here.</p>}
        {shown.map((l) => (
          <div key={l.id} className={`px-2 py-0.5 border-b border-neutral-800/60 whitespace-pre-wrap break-words ${LEVEL_STYLE[l.level]}`}>
            <span className="text-neutral-600">{new Date(l.at).toLocaleTimeString([], { hour12: false })} </span>{l.text}
            {l.path !== '/' && <span className="text-neutral-600"> · {l.path}</span>}
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}

const CHECK_STYLE: Record<CheckLevel, string> = { error: 'text-red-300', warn: 'text-amber-300', info: 'text-neutral-400' };
const CHECK_MARK: Record<CheckLevel, string> = { error: '✕', warn: '!', info: 'i' };

function ChecksBox({ checks, open }: { checks: ReturnType<typeof liveChecks>; open: (path: string) => void }) {
  if (!checks.length) return <p className="p-3 text-[11px] text-emerald-300">No problems found on any page.</p>;
  const byPage = Array.from(new Set(checks.map((c) => c.path)));
  return (
    <div className="p-2 flex flex-col gap-2 text-[11px]">
      {byPage.map((p) => (
        <div key={p || 'project'}>
          <button onClick={() => open(p)} disabled={!p} className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300 disabled:hover:text-neutral-500">{p || 'project'}</button>
          {checks.filter((c) => c.path === p).map((c, i) => (
            <div key={i} className={`flex gap-1.5 leading-snug ${CHECK_STYLE[c.level]}`}><span className="w-3 shrink-0 text-center font-mono">{CHECK_MARK[c.level]}</span>{c.text}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Phones see Live pages through a read-only gateway that's off until you turn it on here (lib/server/phoneShare.ts):
// the app itself only answers this computer.
function PhoneBox({ path }: { path: string }) {
  type Lan = { hosts: string[]; sharing: { port: number; until: number } | null; error?: string };
  const [lan, setLan] = useState<Lan | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const load = (r: Promise<Response>) => r.then((x) => x.json()).then(setLan, () => setLan({ hosts: [], sharing: null, error: 'Dev server unreachable' }));
  useEffect(() => { load(fetch('/api/lan')); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  const share = (on: boolean) => load(fetch('/api/lan', { method: 'PUT', body: JSON.stringify({ on }) }));
  const s = lan?.sharing && lan.sharing.until > now ? lan.sharing : null;
  const urls = s ? lan!.hosts.map((h) => `http://${h}:${s.port}${path}`) : [];
  const BTN = 'text-[10px] font-mono px-2 py-0.5 rounded border border-neutral-700 hover:bg-neutral-800';
  return (
    <div className="p-3 flex flex-col gap-2 text-[11px] text-neutral-300">
      <span className="text-[10px] uppercase tracking-widest text-sky-400">Open on a phone</span>
      {!lan ? <p className="text-neutral-500">Looking up this computer&apos;s address…</p>
      : lan.error ? <p className="text-red-300">{lan.error}</p>
      : !lan.hosts.length ? <p className="text-neutral-500">No network address found. Is this computer on wifi or ethernet?</p>
      : !s ? (
        <>
          <p className="text-neutral-400 leading-relaxed">Alchemy only answers this computer. Sharing lets phones on this Wi-Fi view Live pages, and nothing else: they can&apos;t edit or delete anything.</p>
          <button className={`${BTN} self-start text-sky-300`} onClick={() => share(true)}>Share on this Wi-Fi</button>
        </>
      ) : (
        <>
          {urls.map((u) => (
            <div key={u} className="flex items-center gap-2">
              <code className="flex-1 min-w-0 break-all text-[12px] text-amber-200">{u}</code>
              <button className={BTN} onClick={() => navigator.clipboard.writeText(u).then(() => { setCopied(u); setTimeout(() => setCopied(null), 1500); })}>{copied === u ? 'copied' : 'copy'}</button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">Sharing, view only</span>
            <span className="text-neutral-500">· off in {Math.max(1, Math.round((s.until - now) / 60000))} min</span>
            <button className={`${BTN} ml-auto`} onClick={() => share(false)}>Stop</button>
          </div>
          <p className="text-[10px] text-neutral-500 leading-relaxed">
            Anyone on this network can view these pages while sharing is on. The phone reloads by itself when you change the page on Web.
            If it can&apos;t connect, the firewall may be blocking port {s.port} (for ufw: <code>sudo ufw allow {s.port}/tcp</code>).
          </p>
        </>
      )}
    </div>
  );
}
