// A finished bible, packed to hand over: for people and for the agent that builds it.
//   npm run bible:handoff -- <bible>   → design/<bible>/handoff/   (the Ideation canvas's Hand off button runs this)
//
//   <bible>.pdf          the vector bible: the overview and the topics' pages (no as-is survey, no Gaps)
//   AGENT.md             start here (an agent): what this is, the order of work, what each file is for
//   briefs.md            every topic's decisions, leanings, open questions and agent brief, flattened, in topic order
//   tokens/              the theme as CSS variables + JSON, and the fonts
//   components/<id>/     how each component was made: its recipe (JSON), the CSS it generates, a preview page
//   behaviors/<key>.js   the runtimes those components use (reference)
//   mockup/              the live mockup as code: each page as plain HTML (Home holds every section in place), and as Next.js
// Everything is generated from the bible and the workspace project of the same id (projects/<bible>.json); the folder
// is replaced whole each run. The web parts are left out when the bible has no web project.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { generatePageHTML, generatePageTSX } from '@/lib/generator/page';
import { BEHAVIORS, behaviorsUsed, recipeToCss, themeToCss, fontsHref } from '@/lib/library';
import { pageSections, projectTheme, type PageDef, type ProjectData } from '@/lib/project';
import type { Bible, DesignPage } from '@/lib/design/types';

const bible = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!bible) { console.error('usage: bible:handoff -- <bible>'); process.exit(1); }
const dir = path.join('design', bible), out = path.join(dir, 'handoff');
if (!existsSync(path.join(dir, 'bible.json'))) { console.error(`no bible at ${dir}`); process.exit(1); }
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const put = (rel: string, text: string) => { const f = path.join(out, rel); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, text); };
const made: string[] = [];

// ── the PDF (the export script, in handoff mode) ──
const pdf = spawnSync(process.execPath, ['scripts/run.cjs', 'scripts/bible-export.tsx', bible, '--handoff', '--out', path.join(out, `${bible}.pdf`)], { encoding: 'utf8', timeout: 600_000 });
if (pdf.status !== 0) { console.error(pdf.stderr || pdf.stdout); process.exit(1); }
made.push(`${bible}.pdf`);

// ── briefs.md: every topic, in the bible's order ──
const doc = JSON.parse(readFileSync(path.join(dir, 'bible.json'), 'utf8')) as Bible & { pitch?: string };
type K = { id: string; kind: string; text: string; why?: string };
type Agent = { brief?: string; rules?: string[]; open?: string[] };
const pageOf = (id?: string): (DesignPage & { knowledge?: K[]; agent?: Agent }) | null => {
  const f = id ? path.join(dir, 'pages', `${id}.json`) : '';
  return f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n');
const STATUS: Record<string, string> = { decided: 'decided', hypothesis: 'leaning, not decided', blank: 'not started' };
const briefs: string[] = [`# ${doc.title}: briefs`, '', `Generated from the design bible (${new Date().toISOString().slice(0, 10)}). Every topic in order: what's decided, what's still a leaning, what's open, and the brief for whoever builds it. The PDF draws the same decisions.`, ''];
let group = '';
for (const t of doc.topics) {
  if (t.group !== group) { group = t.group; briefs.push(`## ${group}`, ''); }
  const p = pageOf(t.page);
  briefs.push(`### ${t.title} (${STATUS[t.status] ?? t.status})`, '');
  if (t.summary) briefs.push(t.summary, '');
  const k = p?.knowledge ?? [];
  const of = (kind: string) => k.filter((x) => x.kind === kind);
  if (of('decision').length) briefs.push('**Decided**', '', of('decision').map((x) => `- ${x.text}${x.why ? `\n  _Why: ${x.why}_` : ''}`).join('\n'), '');
  if (of('hypothesis').length) briefs.push('**Leaning (not decided)**', '', list(of('hypothesis').map((x) => x.text)), '');
  if (of('question').length) briefs.push('**Open questions**', '', list(of('question').map((x) => x.text)), '');
  if (of('evidence').length) briefs.push('**Found in the code**', '', list(of('evidence').map((x) => x.text)), '');
  const a = p?.agent;
  if (a?.brief || a?.rules?.length || a?.open?.length) {
    briefs.push('**Brief for the builder**', '');
    if (a.brief) briefs.push(a.brief, '');
    if (a.rules?.length) briefs.push(list(a.rules), '');
    if (a.open?.length) briefs.push('Open:', '', list(a.open), '');
  }
}
put('briefs.md', briefs.join('\n'));
made.push('briefs.md');

// ── the web project: tokens, components, behaviors, the mockup ──
const projFile = path.join('projects', `${bible}.json`);
const project = existsSync(projFile) ? JSON.parse(readFileSync(projFile, 'utf8')) as ProjectData : null;
let web: string[] = [];
if (project) {
  const theme = projectTheme(project), comps = project.components ?? {};
  const fonts = fontsHref(project.meta.fonts);
  put('tokens/theme.css', `/* ${doc.title}: design tokens, as CSS variables (generated from the Alchemy project) */\n${themeToCss(theme)}\n`);
  put('tokens/theme.json', JSON.stringify({ tokens: theme.tokens, fonts: project.meta.fonts ?? [], fontsHref: fonts }, null, 2) + '\n');
  // Components: the recipe, the CSS it makes, a page with one of it (its defaults, the theme, its behaviors)
  const ids = Object.keys(comps);
  for (const id of ids) {
    const r = comps[id].recipe;
    put(`components/${id}/recipe.json`, JSON.stringify(r, null, 2) + '\n');
    put(`components/${id}/style.css`, recipeToCss(r) + '\n');
    const page = { path: `/${id}`, name: r.name } as PageDef;
    put(`components/${id}/preview.html`, generatePageHTML(page, { placements: [{ id: 'sample', componentId: id, col: 0, row: 0, colSpan: 8, rowSpan: 2 }] }, comps, theme, project.meta));
  }
  const keys = behaviorsUsed(ids.map((id) => comps[id].recipe));
  for (const k of keys) put(`behaviors/${k}.js`, `// ${BEHAVIORS[k].name} — reference: the runtime the mockup ships (self-contained, no imports)\n// Support: ${BEHAVIORS[k].support}\nexport const ${k} = ${BEHAVIORS[k].attach.toString()};\n`);
  // The mockup: every page, as HTML and as a Next.js page
  const routes: string[] = [];
  const fileOf = (p: string) => (p === '/' ? 'index' : p.replace(/^\//, '').replace(/\//g, '-'));
  // Opened from disk, a link to a page of the site goes to its file (href="/work" → work.html)
  const paths = new Set(project.pages.map((p) => p.path));
  const relink = (html: string) => html.replace(/href="(\/[^"#?]*)([#?][^"]*)?"/g, (m, p: string, rest = '') => (paths.has(p) ? `href="${fileOf(p)}.html${rest}"` : m));
  for (const page of project.pages) {
    const layout = project.layouts[page.path];
    if (!layout) continue;
    const name = fileOf(page.path);
    const secs = pageSections(project, page);
    put(`mockup/${name}.html`, relink(generatePageHTML(page, layout, comps, theme, project.meta, secs)));
    put(`mockup/next/app${page.path === '/' ? '' : page.path}/page.tsx`, generatePageTSX(page, layout, comps, theme, project.meta, secs));
    routes.push(`${page.path} → mockup/${name}.html${secs.length ? ` (with ${secs.length} sections in place)` : ''}`);
  }
  web = [
    '## The web side (reference, not code to copy)', '',
    "The mockup was built in Alchemy from the bible's decisions. Use it to see and check the intended result: layout per screen size, components, states, behaviors. Build the site in its own stack and conventions; don't paste the mockup's `al-*` classes, `data-behavior` attributes or generated CSS into it.", '',
    `- \`tokens/\`: the theme. ${Object.keys(theme.tokens).length} tokens as CSS variables (\`theme.css\`) and JSON, and the fonts${fonts ? ` (${fonts})` : ''}. These values are the decided ones; map them onto the site's own token names.`,
    `- \`components/<id>/\`: how each of the ${ids.length} components was made (${ids.map((i) => comps[i].recipe.name).join(', ')}): \`recipe.json\` (its parts, props, variants, states, per-screen changes and behaviors, as data), \`style.css\` (the CSS Alchemy makes from it), \`preview.html\` (one of it, open in a browser).`,
    `- \`behaviors/\`: the runtimes those components use (${keys.join(', ')}): plain, self-contained browser JS. Reference for the behavior and its timings; the site writes its own (the moth and Cori live on its game canvas there).`,
    '- `mockup/`: the live mockup, opened straight from disk. Home holds every section in place, as the site does:', '',
    list(routes), '',
    '  `mockup/next/` has the same pages as Next.js App Router files.', '',
  ];
  made.push('tokens/', 'components/', 'behaviors/', 'mockup/');
}

// ── AGENT.md: start here ──
const scope = pageOf(doc.topics.find((t) => t.id === 'scope')?.page);
const order = scope?.knowledge?.find((k) => k.id === 'k-order');
const counts = doc.topics.reduce((c, t) => ({ ...c, [t.status]: (c[t.status] ?? 0) + 1 }), {} as Record<string, number>);
put('AGENT.md', [
  `# ${doc.title}: hand-off`, '',
  doc.pitch ?? '', '',
  `This folder is the finished design, generated from its design bible (${new Date().toISOString().slice(0, 10)}): ${counts.decided ?? 0} topics decided, ${counts.hypothesis ?? 0} leaning, ${counts.blank ?? 0} not started.`, '',
  '## Read in this order', '',
  `1. \`${bible}.pdf\`: the design, page by page (the overview first). Pictures and the decisions on them.`,
  '2. `briefs.md`: the same decisions as text, every topic in order, with the brief for whoever builds it: rules, file names, open questions.',
  ...(project ? ['3. The web side below: tokens, components, behaviors and a working mockup, all reference.'] : []), '',
  '## How to work from it', '',
  '- Decided means decided: build it as written. A leaning is a proposal to try and show, not to settle alone. Open questions go back to the person who owns the design.',
  '- When two things disagree, the decision in `briefs.md` wins over a drawing; ask if it matters.',
  "- Never invent copy, links or URLs the briefs don't give (Cori's lines, résumé and repo links come from the owner).",
  ...(order ? ['', '## The order of work', '', order.text, ...(order.why ? ['', `_Why: ${order.why}_`] : []), ...(scope?.agent?.rules?.length ? ['', list(scope.agent.rules)] : [])] : []), '',
  ...web,
  '## Files', '',
  list(['AGENT.md (this file)', ...made]), '',
].join('\n'));

console.log(`${out}/\n${list(['AGENT.md', ...made])}`);
