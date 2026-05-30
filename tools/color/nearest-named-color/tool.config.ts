import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-nearest-named-color-v1',
  name: 'Nearest CSS Named Color',
  slug: 'nearest-named-color',
  description: 'Find the closest CSS/X11 named color to any input color by perceptual distance.',
  category: 'color',
  tags: ['css', 'named-color', 'x11', 'delta-e', 'color'],
  keywords: ['nearest color', 'css colors', 'x11', 'lab', 'cie76', 'closest name', 'color name'],
  icon: 'Tag',
  relatedTools: [],
};

export default meta;
