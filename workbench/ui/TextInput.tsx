"use client";

// Shared bordered text input for T3 panel modules. Pass width
// (`flex-1`/`w-full`) and focus border color via `className`.

export function TextInput({
  value, onChange, placeholder, className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-neutral-800 text-neutral-200 text-xs px-2 py-1 rounded border border-neutral-700 focus:outline-none placeholder:text-neutral-600 ${className}`}
    />
  );
}
