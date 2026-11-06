"use client";

// Shared pill toggle switch. `size="md"` (default) is the larger fab-module
// variant; `size="sm"` is the compact settings-row variant.

const SIZES = {
  sm: { track: 'w-8 h-4',     knob: 'w-3 h-3',      top: 'top-0.5',  onX: 'translate-x-4',     offX: 'translate-x-0.5' },
  md: { track: 'w-9 h-[18px]', knob: 'w-[14px] h-[14px]', top: 'top-[2px]', onX: 'translate-x-[20px]', offX: 'translate-x-[2px]' },
} as const;

export function Toggle({
  on, onToggle, size = 'md',
}: {
  on: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}) {
  const c = SIZES[size];
  return (
    <button
      onClick={onToggle}
      className={`relative block p-0 ${c.track} rounded-full transition-colors shrink-0 ${on ? 'bg-indigo-500' : 'bg-neutral-700'}`}
    >
      {/* left-0 anchors the knob — without it the absolute span sits at its static (centered) position and slides off the track */}
      <span className={`absolute left-0 ${c.top} ${c.knob} rounded-full bg-white transition-transform ${on ? c.onX : c.offX}`} />
    </button>
  );
}
