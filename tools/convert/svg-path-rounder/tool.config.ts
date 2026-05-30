import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-svg-path-rounder-v1',
  name: 'SVG Path Coordinate Rounder',
  slug: 'svg-path-rounder',
  description:
    "Round and tidy the numeric coordinates in an SVG path 'd' string to reduce precision and file size.",
  category: 'convert',
  tags: ['svg', 'path', 'optimize', 'minify', 'round'],
  keywords: ['svg path', 'd attribute', 'precision', 'coordinates', 'file size', 'bezier', 'arc'],
  icon: 'Spline',
  relatedTools: [],
};

export default meta;
