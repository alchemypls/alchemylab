import type { PageDef } from './project';

// A project's pages as a folder tree. Folders are implied by path segments: /blog/post puts "post" inside "blog".
// A node can be both a page and a folder (/blog and /blog/post).

export interface RouteNode {
  seg:      string;
  path:     string;
  page?:    PageDef;
  children: RouteNode[];
}

export function buildRouteTree(pages: PageDef[]): RouteNode {
  const root: RouteNode = { seg: '', path: '/', children: [] };
  for (const page of pages) {
    const segs = page.path.split('/').filter(Boolean);
    let node = root;
    segs.forEach((seg, i) => {
      const path = '/' + segs.slice(0, i + 1).join('/');
      let child = node.children.find((c) => c.seg === seg);
      if (!child) { child = { seg, path, children: [] }; node.children.push(child); }
      node = child;
    });
    node.page = page;
  }
  const sort = (n: RouteNode) => {
    n.children.sort((a, b) => (b.children.length > 0 ? 1 : 0) - (a.children.length > 0 ? 1 : 0) || a.seg.localeCompare(b.seg));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

export const normalizePath = (raw: string) =>
  '/' + raw.trim().split('/').map((s) => s.trim()).filter(Boolean).join('/');

export const nameFromPath = (path: string) => {
  const last = path.split('/').filter(Boolean).pop() ?? 'home';
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/[-_]/g, ' ');
};
