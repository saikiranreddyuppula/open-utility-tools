import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-polar-cartesian-converter-v1',
  name: 'Polar ↔ Cartesian Converter',
  slug: 'polar-cartesian-converter',
  description: 'Convert 2D points between polar (r, θ) and Cartesian (x, y) coordinates.',
  category: 'math',
  tags: ['polar', 'cartesian', 'coordinates', 'geometry', 'trigonometry'],
  keywords: [
    'polar to cartesian',
    'cartesian to polar',
    'radius angle',
    'atan2',
    'degrees radians',
    'quadrant',
    'r theta',
  ],
  icon: 'Compass',
  relatedTools: [],
};

export default meta;
