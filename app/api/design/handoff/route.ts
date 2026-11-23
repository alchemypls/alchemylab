// The hand-off: POST /api/design/handoff?bible=x runs `npm run bible:handoff -- x` (scripts/bible-handoff.tsx) and
// answers when design/<x>/handoff/ is written: the PDF, AGENT.md, briefs.md and, with a web project, its tokens,
// components, behaviors and mockup. One run at a time per bible. Local only, like every API route (middleware.ts).

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { SLUG } from '@/lib/design/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const running = new Set<string>();

export async function POST(req: Request) {
  const bible = new URL(req.url).searchParams.get('bible');
  if (!bible || !SLUG.test(bible)) return Response.json({ error: 'bible required' }, { status: 400 });
  if (!existsSync(path.join(process.cwd(), 'design', bible, 'bible.json'))) return Response.json({ error: `no bible "${bible}"` }, { status: 404 });
  if (running.has(bible)) return Response.json({ error: 'a hand-off for this bible is already running' }, { status: 409 });
  running.add(bible);
  try {
    const { code, out } = await new Promise<{ code: number | null; out: string }>((done) => {
      const p = spawn(process.execPath, ['scripts/run.cjs', 'scripts/bible-handoff.tsx', bible], { cwd: process.cwd() });
      let out = '';
      p.stdout.on('data', (d) => { out += d; });
      p.stderr.on('data', (d) => { out += d; });
      p.on('close', (c) => done({ code: c, out }));
      p.on('error', (e) => done({ code: 1, out: String(e) }));
    });
    const lines = out.split('\n').filter((l) => l.trim() && !/TensorFlow|^\[\d+:\d+/.test(l));   // Chrome's own chatter
    if (code !== 0) return Response.json({ error: lines.slice(-6).join('\n') || 'the hand-off failed' }, { status: 500 });
    return Response.json({ dir: `design/${bible}/handoff`, files: lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2)) });
  } finally {
    running.delete(bible);
  }
}
