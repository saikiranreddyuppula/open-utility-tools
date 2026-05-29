import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-shades-v1',
  name: 'Tints & Shades Generator',
  slug: 'color-shades',
  description: 'Generate a tint/shade ramp from a base color, with copyable values.',
  category: 'color',
  tags: ['shades', 'tints', 'palette', 'ramp', 'scale'],
  keywords: ['shades', 'tints', 'color scale', 'palette', 'lighten darken', 'tailwind'],
  icon: 'Blend',
  relatedTools: ['color-converter', 'gradient-generator', 'contrast-checker'],
};

export default meta;
