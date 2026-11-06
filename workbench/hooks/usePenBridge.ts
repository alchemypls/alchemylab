import { useEffect, useRef, useState } from 'react';

// ── usePenBridge ──────────────────────────────────────────────────
//
// Subscribes to /api/pen?source=… (Server-Sent Events) while `source` is set.
//   local       USB tablet, exclusively grabbed — its input reaches only this subscriber
//   remarkable  Paper Pro over SSH, mirrored (not grabbed — it keeps inking on paper)
// Clearing the source / unmounting closes the stream → the bridge exits (grab released).

export interface PenSample {
  x: number; y: number;   // 0..1 across the tablet's active area
  p: number;              // pressure 0..1
  prox: boolean;          // pen within hover range
  down: boolean;          // tip touching
  eraser: boolean;        // eraser end (or eraser tool) in use
  b1: boolean; b2: boolean;
}

export type PenStatus = 'off' | 'connecting' | 'live' | 'error';

export type PenSource = 'local' | 'remarkable';

export const PEN_SOURCES: { value: PenSource; label: string }[] = [
  { value: 'local',      label: 'USB tablet' },
  { value: 'remarkable', label: 'reMarkable' },
];

// map: 'fit' — tablet area letterboxed onto the page (USB tablets)
//      'screen' — tablet *screen* maps 1:1 onto page width; page lengthens to match (reMarkable)
export interface PenInfo { name: string; path: string; aspect: number; grabbed: boolean; map: 'fit' | 'screen' }

export function usePenBridge(source: PenSource | null, onSample: (s: PenSample) => void) {
  const [status, setStatus] = useState<PenStatus>('off');
  const [error,  setError]  = useState<{ code: string; message: string } | null>(null);
  const [info,   setInfo]   = useState<PenInfo | null>(null);
  const sampleRef = useRef(onSample);
  sampleRef.current = onSample;

  useEffect(() => {
    if (!source) { setStatus('off'); setInfo(null); return; }
    setStatus('connecting');
    setError(null);
    const es = new EventSource(`/api/pen?source=${source}`);
    let failed = false;
    const fail = (code: string, message: string) => {
      failed = true;
      setError({ code, message });
      setStatus('error');
      es.close();
    };
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'pen')         sampleRef.current(msg as PenSample);
      else if (msg.type === 'info')   { setInfo(msg); setStatus('live'); }
      else if (msg.type === 'error')  fail(msg.code, msg.message);
      else if (msg.type === 'closed' && !failed) fail('CLOSED', `Pen bridge exited (code ${msg.code})`);
    };
    es.onerror = () => { if (!failed) fail('CONN', 'Lost connection to the pen bridge (is `npm run dev` running?)'); };
    return () => es.close();
  }, [source]);

  return { status, error, info };
}
