// ── Devices & breakpoint tiers (mobile-first) ────────────────────
// Tiers are the semantic breakpoints everything downstream keys on (sketches now; layouts and
// generated @media rules next). Mobile-first: each tier applies from its minWidth upward.
// Devices are just named viewport sizes (CSS px, portrait) for picking — like Chrome DevTools.

export type Tier = 'mobile' | 'tablet' | 'desktop';

export const TIERS: { id: Tier; label: string; minWidth: number }[] = [
  { id: 'mobile',  label: 'Mobile',  minWidth: 0    },
  { id: 'tablet',  label: 'Tablet',  minWidth: 600  },
  { id: 'desktop', label: 'Desktop', minWidth: 1024 },
];

export const tierOf = (width: number): Tier =>
  width >= 1024 ? 'desktop' : width >= 600 ? 'tablet' : 'mobile';

export const TIER_ORDER: Tier[] = ['mobile', 'tablet', 'desktop'];

// Layout grid columns per tier
export const TIER_COLUMNS: Record<Tier, number> = { mobile: 4, tablet: 8, desktop: 12 };

export type DeviceCategory = 'Phones' | 'Tablets' | 'Laptops' | 'Desktops';

export interface DevicePreset {
  id:       string;
  name:     string;
  category: DeviceCategory;
  width:    number;  // CSS px, portrait for phones/tablets
  height:   number;
}

export const DEVICES: DevicePreset[] = [
  { id: 'iphone-se',        name: 'iPhone SE',          category: 'Phones',   width: 375,  height: 667  },
  { id: 'iphone-15',        name: 'iPhone 15 / 16',     category: 'Phones',   width: 393,  height: 852  },
  { id: 'iphone-16-promax', name: 'iPhone 16 Pro Max',  category: 'Phones',   width: 440,  height: 956  },
  { id: 'pixel-8',          name: 'Pixel 8',            category: 'Phones',   width: 412,  height: 915  },
  { id: 'galaxy-s24',       name: 'Galaxy S24',         category: 'Phones',   width: 360,  height: 780  },
  { id: 'ipad-mini',        name: 'iPad mini',          category: 'Tablets',  width: 744,  height: 1133 },
  { id: 'ipad-air',         name: 'iPad Air 11"',       category: 'Tablets',  width: 820,  height: 1180 },
  { id: 'galaxy-tab-s9',    name: 'Galaxy Tab S9',      category: 'Tablets',  width: 800,  height: 1280 },
  { id: 'ipad-pro-13',      name: 'iPad Pro 13"',       category: 'Tablets',  width: 1032, height: 1376 },
  { id: 'laptop-1280',      name: 'Laptop 1280',        category: 'Laptops',  width: 1280, height: 800  },
  { id: 'laptop-1366',      name: 'Laptop 1366',        category: 'Laptops',  width: 1366, height: 768  },
  { id: 'macbook-air-13',   name: 'MacBook Air 13"',    category: 'Laptops',  width: 1470, height: 956  },
  { id: 'desktop-1440',     name: 'Desktop 1440',       category: 'Desktops', width: 1440, height: 900  },
  { id: 'desktop-1920',     name: 'Desktop 1080p',      category: 'Desktops', width: 1920, height: 1080 },
  { id: 'desktop-2560',     name: 'Desktop 1440p',      category: 'Desktops', width: 2560, height: 1440 },
];

export const DEVICE_CATEGORIES: DeviceCategory[] = ['Phones', 'Tablets', 'Laptops', 'Desktops'];

export const deviceById = (id: string | undefined) => DEVICES.find((d) => d.id === id);

// What the editor is currently viewing. deviceId 'responsive' = free W×H.
export interface ViewportSize { deviceId: string; width: number; height: number }

export const DEFAULT_VIEWPORT: ViewportSize = { deviceId: 'iphone-15', width: 393, height: 852 };

// Starting device when a tier is first opened without one
export const TIER_DEFAULT_DEVICE: Record<Tier, string> = {
  mobile: 'iphone-15', tablet: 'ipad-air', desktop: 'desktop-1440',
};

export const clampViewport = (n: number) => Math.round(Math.min(3840, Math.max(240, n || 0)));
