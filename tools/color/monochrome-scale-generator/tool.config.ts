import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-monochrome-scale-generator-v1',
  name: 'Monochromatic Scale Generator',
  slug: 'monochrome-scale-generator',
  description: 'Build a single-hue scale by varying lightness and saturation in even steps.',
  category: 'color',
  tags: ['color', 'monochrome', 'scale', 'palette', 'generator'],
  keywords: ['monochromatic', 'single hue', 'lightness', 'ramp', 'tailwind scale', 'oklch', 'css variables'],
  icon: 'SlidersHorizontal',
  relatedTools: [],
};

export default meta;
