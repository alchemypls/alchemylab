"use client";

// Shared uppercase tracking-widest section heading used across T3 panel
// modules. `size="sm"` is the compact 9px variant used inside fab module
// sub-sections (includes its own mb-1.5); `size="md"` (default) is the
// 10px panel-section variant — pass padding via `className`.

const SIZE_CLASS: Record<'sm' | 'md', string> = {
  sm: 'text-[9px] mb-1.5',
  md: 'text-[10px]',
};

export function SectionLabel({
  children, size = 'md', className = '',
}: {
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`uppercase tracking-widest text-neutral-500 ${SIZE_CLASS[size]} ${className}`.trim()}>
      {children}
    </div>
  );
}
