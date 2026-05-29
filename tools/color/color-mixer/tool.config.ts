import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-color-mixer-v1',
  name: 'Color Mixer / Blender',
  slug: 'color-mixer',
  description:
    'Blend two colors at any ratio to find the resulting mix, with adjustable percentage and live HEX/RGB output of the blended color.',
  category: 'color',
  tags: ['mix', 'blend', 'color'],
  keywords: ['mix', 'blend', 'interpolate', 'average', 'two colors'],
  icon: 'Blend',
  relatedTools: [],
};

export default meta;
