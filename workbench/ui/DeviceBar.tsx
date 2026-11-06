"use client";

import { RotateCw } from 'lucide-react';
import {
  DEVICES, DEVICE_CATEGORIES, TIERS, ViewportSize, clampViewport, deviceById, tierOf,
} from '@/lib/devices';

// DevTools-style viewport bar: device dropdown (grouped) + Responsive, W × H inputs, rotate,
// and the breakpoint tier the width falls in. Typing a size switches to Responsive.
export function DeviceBar({ value, onChange, className = '', compact }: {
  value: ViewportSize;
  compact?: boolean;   // no "Dimensions:" label (a narrow panel)
  onChange: (v: ViewportSize) => void;
  className?: string;
}) {
  const tier   = TIERS.find((t) => t.id === tierOf(value.width))!;
  const device = deviceById(value.deviceId);
  const rotated = !!device && value.width === device.height && value.height === device.width;

  const setSize = (width: number, height: number) =>
    onChange({ deviceId: 'responsive', width: clampViewport(width), height: clampViewport(height) });

  const input = 'w-14 bg-[#141310] border border-[#3e3b33] px-1.5 py-0.5 text-[10px] text-[#f2ebd9] font-mono outline-none focus:border-[#7d7461] text-center';

  return (
    <div className={`flex items-center gap-x-2 gap-y-1 flex-wrap font-sans ${className}`}>
      {!compact && <span className="text-[10px] text-[#8c8576]">Dimensions:</span>}
      <select
        value={device ? device.id : 'responsive'}
        onChange={(e) => {
          const d = deviceById(e.target.value);
          onChange(d ? { deviceId: d.id, width: d.width, height: d.height } : { ...value, deviceId: 'responsive' });
        }}
        className={`bg-[#141310] border border-[#3e3b33] text-[10px] px-1.5 py-0.5 text-[#f2ebd9] outline-none cursor-pointer ${compact ? 'min-w-0 flex-1' : ''}`}
      >
        <option value="responsive">Responsive</option>
        {DEVICE_CATEGORIES.map((cat) => (
          <optgroup key={cat} label={cat}>
            {DEVICES.filter((d) => d.category === cat).map((d) => (
              <option key={d.id} value={d.id}>{d.name} · {d.width}×{d.height}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <input
        key={`w${value.width}`}
        defaultValue={value.width}
        onBlur={(e) => setSize(Number(e.target.value), value.height)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className={input}
        title="Width (CSS px)"
      />
      <span className="text-[10px] text-[#8c8576]">×</span>
      <input
        key={`h${value.height}`}
        defaultValue={value.height}
        onBlur={(e) => setSize(value.width, Number(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className={input}
        title="Height (CSS px)"
      />
      <button
        onClick={() => onChange({ ...value, width: value.height, height: value.width })}
        className={`p-1 rounded hover:bg-[#2a2723] ${rotated ? 'text-indigo-300' : 'text-[#8c8576]'}`}
        title="Rotate"
      >
        <RotateCw size={12} />
      </button>

      <span
        className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono border border-[#3e3b33] text-[#d4cbb8]"
        title={`Breakpoint tier: ${tier.label} (≥ ${tier.minWidth}px). Each tier has its own sketch.`}
      >
        {tier.label}
      </span>
    </div>
  );
}
