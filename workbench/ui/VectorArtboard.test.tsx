// Drawing snapshots: a sample page with every kind of element, drawn by the canvas's own VectorArtboard, compared with
// the SVG saved beside this file. It fails when a change draws anything differently. When the change is meant
// (a new look), look at the new picture and update the saved one: `npx vitest run -u`.
// The page and the vault piece on it are defined here, so editing your real pages never breaks this.
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { fitBlocks, type VaultAsset } from '@/lib/design/vault';
import type { Bible, DesignPage } from '@/lib/design/types';
import { primeVault } from '@/workbench/hooks/useVault';
import { VectorArtboard } from './VectorArtboard';

const POST: VaultAsset = {
  kind: 'block', title: 'Post', updated: '2026-11-07', blocks: [], size: { width: 1024, height: 1024 }, grid: { cell: 64 }, footprint: { cols: 1, rows: 1 },
  elements: [
    { id: 'base', type: 'ellipse', x: 512, y: 593.6, w: 28.8, h: 28.8, fill: '#f4efe6', stroke: '#1f1b16', strokeWidth: 1.5, plane: 'floor', height: 22.4 },
    { id: 'cap', type: 'ellipse', x: 512, y: 584, w: 48, h: 48, fill: '#2a2623', stroke: '#1f1b16', strokeWidth: 1.5, plane: 'roof', lift: 22.4, height: 19.2 },
  ],
};

const BIBLE: Bible = {
  title: 'Sample', pitch: 'A page that draws one of everything.', created: '2026-11-07', template: 'game',
  topics: [{ id: 'pillars', group: 'Vision', title: 'Pillars', summary: 'What it must always be.', status: 'decided' }],
} as Bible;

const PAGE: DesignPage = {
  title: 'Sample', blocks: [], size: { width: 960, height: 540 }, grid: { cell: 32 }, background: '#f4efe6',
  layers: [{ id: 'floor', name: 'Floor' }, { id: 'top', name: 'Top' }, { id: 'off', name: 'Hidden', hidden: true }],
  elements: [
    { id: 'floor', type: 'zone', x: 640, y: 120, cols: 4, rows: 4, cell: 32, fill: '#c9a36b', stroke: '#b08b55', layer: 'floor' },
    { id: 'lane', type: 'rect', x: 640, y: 120, w: 32, h: 128, fill: '#2f6fd6', plane: 'floor', on: 'floor', layer: 'floor' },
    { id: 'post', type: 'asset', asset: 'post', x: 620, y: 128, w: 40, h: 40, layer: 'floor' },   // stands on tile (1, 1): its base at (640, 168)
    { id: 'box', type: 'rect', x: 40, y: 40, w: 160, h: 80, fill: '#fbf8f2', stroke: '#1f1b16', strokeWidth: 2, radius: 8, layer: 'top' },
    { id: 'turned', type: 'rect', x: 240, y: 40, w: 120, h: 40, fill: '#d6332f', rotate: 30, layer: 'top' },
    { id: 'blob', type: 'ellipse', x: 40, y: 160, w: 100, h: 60, fill: '#f2c230', n: 4, layer: 'top' },
    { id: 'pill', type: 'capsule', x: 160, y: 170, w: 140, h: 40, fill: '#9aa0a6', taper: 0.6, layer: 'top' },
    { id: 'tri', type: 'poly', x: 320, y: 150, w: 80, h: 80, pts: [[0.5, 0], [1, 1], [0, 1]], fill: '#13a89a', layer: 'top' },
    { id: 'arrow', type: 'line', from: { el: 'box' }, to: { el: 'blob' }, stroke: '#b4532a', strokeWidth: 2, dash: true, layer: 'top' },
    { id: 'bent', type: 'line', from: { x: 420, y: 60 }, to: { x: 560, y: 160 }, bend: 40, arrow: 'both', layer: 'top' },
    { id: 'label', type: 'text', x: 40, y: 260, w: 400, h: 40, text: 'Plain text, in caps', size: 20, weight: 600, caps: true, layer: 'top' },
    { id: 'bound', type: 'text', x: 40, y: 310, w: 400, h: 30, text: '', bind: { topic: 'pillars', field: 'summary' }, size: 16, link: 'pillars', layer: 'top' },
    { id: 'dot', type: 'status', x: 450, y: 316, topic: 'pillars', layer: 'top' },
    { id: 'ink', type: 'stroke', points: [[40, 400], [120, 380], [200, 420], [280, 390]], pressures: [0.2, 0.8, 1, 0.4], width: 6, layer: 'top' },
    { id: 'rubbed', type: 'rect', x: 320, y: 380, w: 120, h: 60, fill: '#1f1b16', erased: [{ pts: [10, 30, 110, 30], size: 12 }], layer: 'top' },
    { id: 'secret', type: 'rect', x: 0, y: 0, w: 960, h: 540, fill: '#ff00ff', layer: 'off' },
  ],
};

beforeAll(() => primeVault([{ id: 'post', mtime: null, asset: POST }]));

const draw = (page: DesignPage) =>
  renderToStaticMarkup(<VectorArtboard page={fitBlocks(page, (id) => (id === 'post' ? POST : undefined))} bible={BIBLE} bibleId="sample" onOpen={() => {}} />);

describe('drawing a vector page', () => {
  it('draws every element type the same as last time', async () => {
    await expect(draw(PAGE)).toMatchFileSnapshot('__snapshots__/sample-page.svg');
  });

  it("doesn't draw hidden layers", () => {
    expect(draw(PAGE)).not.toContain('#ff00ff');
  });

  it('shows bound text and status from the bible, not a copy in the page', () => {
    const svg = draw(PAGE);
    expect(svg).toContain('What it must always be.');
    expect(draw({ ...PAGE })).toBe(svg);   // the same page draws the same every time
  });
});
