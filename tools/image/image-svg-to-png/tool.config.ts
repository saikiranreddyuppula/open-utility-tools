import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-svg-to-png-v1',
  name: 'SVG to PNG / JPEG',
  slug: 'image-svg-to-png',
  description: 'Rasterize an SVG (pasted or uploaded) to PNG/JPEG at a chosen scale via canvas.',
  category: 'image',
  tags: ['svg', 'png', 'jpeg', 'rasterize', 'convert'],
  keywords: [
    'svg to png',
    'svg to jpeg',
    'rasterize svg',
    'vector to raster',
    'export svg',
    'svg image',
  ],
  icon: 'FileImage',
  relatedTools: [],
};

export default meta;
