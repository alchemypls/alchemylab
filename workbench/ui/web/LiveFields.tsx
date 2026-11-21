"use client";

import { useEffect, useState } from 'react';
import { liveBackdrop, type LiveBackdrop } from '@/lib/project';

// A live backdrop's fields (Project settings, and a page's own in the page box): the kind, then the sky's colors,
// stars and drift, or the video's address and still. Text commits on blur; what the export would drop is said.

const FIELD = 'bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-indigo-500/60 w-full placeholder:text-neutral-600 font-mono';

function Text({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v.trim()); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} placeholder={placeholder} className={FIELD} />;
}

// `page`: a page's fields, which also offer the project's (unset) and off; `inherited`: the project's
export function LiveFields({ value, onChange, page, inherited }: { value: LiveBackdrop | undefined; onChange: (v: LiveBackdrop | undefined) => void; page?: boolean; inherited?: LiveBackdrop }) {

  const kind = value?.kind ?? '';
  const set = (p: Partial<LiveBackdrop>) => onChange({ ...(value ?? { kind: 'sky' }), ...p } as LiveBackdrop);
  const dropped = value && value.kind !== 'none' && !liveBackdrop(undefined, { live: value });
  const slider = (key: 'stars' | 'speed', label: string) => (
    <label className="flex items-center gap-2 text-[11px] text-neutral-400">
      <span className="w-12 shrink-0">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value?.[key] ?? 0.5} onChange={(e) => set({ [key]: Number(e.target.value) })} className="flex-1 accent-indigo-500" />
      <span className="w-8 text-right font-mono text-[10px]">{(value?.[key] ?? 0.5).toFixed(2)}</span>
    </label>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={kind} className={FIELD}
        onChange={(e) => { const k = e.target.value as LiveBackdrop['kind'] | ''; onChange(k ? (k === value?.kind ? value : { kind: k }) : undefined); }}
        title="A live layer fixed under the page, over the CSS backdrop (which still shows without script, without WebGL, and until it draws)"
      >
        <option value="">{page ? `the project's (${inherited?.kind ?? 'none'})` : 'none'}</option>
        {page && <option value="none">off on this page</option>}
        <option value="sky">sky: nebula + stars (WebGL)</option>
        <option value="video">video (muted loop)</option>
      </select>
      {value?.kind === 'sky' && <>
        <Text value={value.colors ?? ''} onCommit={(v) => set({ colors: v || undefined })} placeholder="night, nebula, glow, stars — e.g. var(--color-bg), #6B3A86" />
        {slider('stars', 'Stars')}
        {slider('speed', 'Drift')}
      </>}
      {value?.kind === 'video' && <>
        <Text value={value.src ?? ''} onCommit={(v) => set({ src: v || undefined })} placeholder="/sky.mp4 or https://…" />
        <Text value={value.poster ?? ''} onCommit={(v) => set({ poster: v || undefined })} placeholder="Still: /sky.jpg (shown first, and when calm)" />
      </>}
      {dropped && <span className="text-[10px] text-rose-400">Not used: {value.kind === 'video' ? 'the video needs a site path (/…) or an https address' : 'colors can’t hold < > { } ; ` \\ $'}</span>}
    </div>
  );
}
