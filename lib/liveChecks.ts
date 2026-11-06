// What the Live canvas's checks box lists: problems with a web project you'd otherwise find by clicking around.
// Pure: reads the project and the HTML each page exports.

import { generatePageHTML } from './generator/page';
import { getActivePlacements, projectTheme, resolvePlacement, type PlacementGeom, type ProjectData } from './project';
import { TIER_ORDER, type Tier } from './devices';

export type CheckLevel = 'error' | 'warn' | 'info';
export interface Check { level: CheckLevel; path: string; text: string }

const overlaps = (a: PlacementGeom, b: PlacementGeom) =>
  a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;

export function liveChecks(project: ProjectData): Check[] {
  const out: Check[] = [];
  const paths = new Set(project.pages.map((p) => p.path));
  if (!project.pages.length) out.push({ level: 'warn', path: '', text: 'The project has no pages yet' });
  if (project.pages.length && !paths.has('/')) out.push({ level: 'warn', path: '', text: 'No home page (/)' });

  for (const page of project.pages) {
    const add = (level: CheckLevel, text: string) => out.push({ level, path: page.path, text });
    const layout = project.layouts[page.path];
    const placed = layout ? getActivePlacements(layout) : [];
    if (!placed.length) { add('warn', 'Nothing placed on this page'); continue; }

    const name = (id: string) => placed.find((p) => p.id === id)?.name ?? project.components?.[placed.find((p) => p.id === id)!.componentId]?.recipe.name ?? id;
    for (const p of placed) {
      if (!project.components?.[p.componentId]) add('error', `“${p.name ?? p.id}” uses a component that's gone (${p.componentId})`);
      if (TIER_ORDER.every((t) => resolvePlacement(p, t).hidden)) add('warn', `“${name(p.id)}” is hidden on every device`);
    }
    for (const tier of TIER_ORDER as Tier[]) {
      const geo = placed.map((p) => ({ id: p.id, g: resolvePlacement(p, tier) })).filter((x) => !x.g.hidden);
      for (let i = 0; i < geo.length; i++) for (let j = i + 1; j < geo.length; j++)
        if (overlaps(geo[i].g, geo[j].g)) add('warn', `“${name(geo[i].id)}” and “${name(geo[j].id)}” overlap on ${tier}`);
    }

    const head = page.head ?? {};
    if (!head.title?.trim() && !project.meta.headTitle?.trim()) add('info', 'No title set; the page name is used');
    if (!head.description?.trim() && !project.meta.headDescription?.trim()) add('warn', 'No description (search results and link previews show one)');

    const html = generatePageHTML(page, layout!, project.components ?? {}, projectTheme(project), project.meta);
    const links = new Set(Array.from(html.matchAll(/\shref="(\/(?!\/)[^"#?]*)/g), (m) => m[1].replace(/\/$/, '') || '/'));
    for (const href of Array.from(links)) if (!paths.has(href)) add('error', `Link to ${href} goes nowhere (no such page)`);
    const noAlt = Array.from(html.matchAll(/<img\b[^>]*>/g)).filter((m) => !/\salt="[^"]+"/.test(m[0])).length;
    if (noAlt) add('warn', `${noAlt} image${noAlt > 1 ? 's' : ''} without alt text`);
  }
  return out;
}
