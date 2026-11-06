"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useWorkbenchStore } from '@/lib/store';
import { useVault } from '@/workbench/hooks/useVault';

// Opens the file vault (vault/ on disk). Only Ideation and Fab use it.
export function VaultButton() {
  const files       = useWorkbenchStore((s) => s.activeScene === 'ideation' || s.activeScene === 'fab');
  const vaultOpen   = useWorkbenchStore((s) => s.fileVaultOpen);
  const toggleVault = useWorkbenchStore((s) => s.toggleFileVault);
  const count       = useVault().entries.length;
  if (!files) return null;

  return (
    <motion.button
      onClick={toggleVault}
      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-[10px] uppercase tracking-widest font-medium transition-colors ${
        vaultOpen
          ? 'bg-indigo-500/15 border-indigo-500/60 text-indigo-300'
          : 'bg-neutral-900/90 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'
      }`}
    >
      {/* Vault icon */}
      <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 fill-current shrink-0">
        <rect x="1" y="3" width="12" height="9" rx="1.5" />
        <rect x="3" y="1" width="8" height="3" rx="1" opacity="0.6" />
        <circle cx="7" cy="7.5" r="1.5" fill="#111" />
        <circle cx="7" cy="7.5" r="0.6" />
      </svg>
      Vault
      {/* Item count badge */}
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{    scale: 0.7, opacity: 0 }}
            className="text-[8px] font-mono bg-neutral-700/80 rounded px-1 py-0.5 text-neutral-300 leading-none"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
