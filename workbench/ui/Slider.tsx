"use client";

import { useState, useId } from 'react';

// ── Types ─────────────────────────────────────────────────────────

export type Notch = {
  value: number;
  label: string;
  snap?: boolean;   // default true — magnetic snap within snapRadius
};

interface NotchedSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  notches?: Notch[];
  snapRadius?: number;  // value units; default = 2.5% of (max - min)
  label?: string;       // shown inline when notches are present
  compact?: boolean;    // narrower value readout, for tight menus
}

// ── NotchedSlider ─────────────────────────────────────────────────
//
// Two modes:
//   Plain (no notches) — returns a React fragment: <input> + <span>
//     → compatible with a flex-row Row wrapper, invisible to layout
//   Notched (notches provided) — returns a self-contained flex-col div:
//     • slider track row (with optional label + active-notch readout)
//     • pill badge row (click to jump, hover to preview label)
//
// Snap: when the dragged value is within snapRadius of a notch whose
// snap !== false, the value locks to that notch automatically.

export function NotchedSlider({
  min, max, step = 1, value, onChange, notches, snapRadius, label, compact,
}: NotchedSliderProps) {
  const uid = useId();
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);

  const radius      = snapRadius ?? (max - min) * 0.025;
  const activeNotch = notches?.find((n) => n.value === value);

  const handleChange = (raw: number) => {
    if (notches) {
      const snap = notches.find((n) => (n.snap !== false) && Math.abs(n.value - raw) <= radius);
      if (snap) { onChange(snap.value); return; }
    }
    onChange(raw);
  };

  // ── Plain mode — just the track + value, no extra wrapping ───────
  if (!notches) {
    return (
      <>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-500 cursor-pointer"
        />
        <span className="text-neutral-300 text-[10px] w-7 text-right tabular-nums shrink-0">
          {value}
        </span>
      </>
    );
  }

  // ── Notched mode ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-1 w-full">
      {/* datalist — provides browser-native tick marks on the track */}
      <datalist id={uid}>
        {notches.map((n) => <option key={n.value} value={n.value} />)}
      </datalist>

      {/* Track row */}
      <div className="flex items-center gap-2">
        {label && (
          <span className="text-neutral-400 text-[10px] w-12 shrink-0">{label}</span>
        )}
        <input
          type="range" min={min} max={max} step={step} value={value}
          list={uid}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-500 cursor-pointer"
        />
        {/* Value readout — shows active notch label below when snapped */}
        <div className={`${compact ? 'w-10' : 'w-14'} shrink-0 flex flex-col items-end leading-none gap-0.5`}>
          <span className="text-neutral-300 text-[10px] tabular-nums">{value}</span>
          {activeNotch && (
            <span className="text-indigo-400/80 text-[8px] text-right leading-tight">
              {activeNotch.label}
            </span>
          )}
        </div>
      </div>

      {/* Pill badge row */}
      <div className={`flex flex-wrap gap-1 ${label ? 'ml-14' : ''}`}>
        {notches.map((n) => {
          const active = value === n.value;
          return (
            <button
              key={n.value}
              onClick={() => onChange(n.value)}
              onMouseEnter={(e) => setTip({ label: n.label, x: e.clientX, y: e.clientY })}
              onMouseMove={(e)  => setTip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
              onMouseLeave={() => setTip(null)}
              className={`px-1.5 py-0.5 rounded border font-mono text-[8px] leading-none transition-colors ${
                active
                  ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600'
              }`}
            >
              {n.value}
            </button>
          );
        })}
      </div>

      {/* Tooltip — fixed so it escapes overflow: hidden on any ancestor */}
      {tip && (
        <div
          className="fixed z-[9999] px-2 py-0.5 rounded text-[8px] text-neutral-200 bg-neutral-800 border border-neutral-700 shadow-md whitespace-nowrap pointer-events-none"
          style={{ left: tip.x + 10, top: tip.y - 28 }}
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}
