import type { ComponentType } from 'react';

/** Canonical tool categories. Order here drives homepage + palette grouping. */
export const CATEGORIES = [
  'image',
  'pdf',
  'data',
  'convert',
  'text',
  'crypto',
  'encoding',
  'generators',
  'web',
  'time',
  'math',
  'color',
] as const;

export type ToolCategory = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  id: ToolCategory;
  name: string;
  /** lucide icon name */
  icon: string;
  description: string;
  /** CSS var token used for the category accent, e.g. "--cat-image" */
  accentVar: string;
}

export const CATEGORY_META: Record<ToolCategory, CategoryMeta> = {
  image: {
    id: 'image',
    name: 'Image',
    icon: 'Image',
    description: 'Convert, resize, compress & inspect images',
    accentVar: '--cat-image',
  },
  pdf: {
    id: 'pdf',
    name: 'PDF',
    icon: 'FileText',
    description: 'Merge, split, rotate & build PDFs',
    accentVar: '--cat-pdf',
  },
  data: {
    id: 'data',
    name: 'Data',
    icon: 'Braces',
    description: 'JSON, CSV, YAML — format, validate, convert',
    accentVar: '--cat-data',
  },
  convert: {
    id: 'convert',
    name: 'Converters',
    icon: 'ArrowLeftRight',
    description: 'Convert between data & text formats',
    accentVar: '--cat-convert',
  },
  text: {
    id: 'text',
    name: 'Text',
    icon: 'Type',
    description: 'Transform, analyze & clean text',
    accentVar: '--cat-text',
  },
  crypto: {
    id: 'crypto',
    name: 'Crypto & Hash',
    icon: 'ShieldCheck',
    description: 'Hashes, HMAC, JWT, keys & ciphers',
    accentVar: '--cat-crypto',
  },
  encoding: {
    id: 'encoding',
    name: 'Encoding',
    icon: 'Binary',
    description: 'Base64, hex, URL, compression & more',
    accentVar: '--cat-encoding',
  },
  generators: {
    id: 'generators',
    name: 'Generators',
    icon: 'Sparkles',
    description: 'UUIDs, passwords, QR, fake data',
    accentVar: '--cat-generators',
  },
  web: {
    id: 'web',
    name: 'Web & Dev',
    icon: 'Globe',
    description: 'URLs, headers, CSS, references',
    accentVar: '--cat-web',
  },
  time: {
    id: 'time',
    name: 'Time & Date',
    icon: 'Clock',
    description: 'Timestamps, timezones, durations',
    accentVar: '--cat-time',
  },
  math: {
    id: 'math',
    name: 'Math & Units',
    icon: 'Calculator',
    description: 'Bases, units, calculators',
    accentVar: '--cat-math',
  },
  color: {
    id: 'color',
    name: 'Color',
    icon: 'Palette',
    description: 'Pick, convert & generate color',
    accentVar: '--cat-color',
  },
};

/**
 * Static, JSON-serializable metadata. Safe to import at build time and into the
 * search index — pulls in zero tool/worker code.
 */
export interface ToolMetaStatic {
  /** Stable id, never changes (used for favorites/recents persistence). */
  id: string;
  name: string;
  /** Unique URL segment. */
  slug: string;
  /** One-line description, shown in cards + <meta>. */
  description: string;
  category: ToolCategory;
  /** Free-text tags shown on the tool page. */
  tags: string[];
  /** Search-only synonyms/aliases (e.g. "b64", "shrink"). */
  keywords: string[];
  /** lucide icon name, resolved client-side. */
  icon: string;
  /** Related tool slugs (validated against registry at build time). */
  relatedTools: string[];
  /** Does this tool load a wasm worker? (drives a small "runs locally" hint). */
  loadWasm?: boolean;
  /** If true, hidden from listings but still routable (e.g. deferred). */
  hidden?: boolean;
}

/** Lazy runtime bindings — each is its own code-split chunk. */
export interface ToolMetaRuntime {
  component: () => Promise<{ default: ComponentType }>;
}

export type ToolConfig = ToolMetaStatic & ToolMetaRuntime;
export type ToolMeta = ToolConfig;
