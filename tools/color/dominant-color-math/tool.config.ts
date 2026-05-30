import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-dominant-color-math-v1',
  name: 'Dominant Color from Palette',
  slug: 'dominant-color-math',
  description: 'Compute the average and dominant color from a list of input colors.',
  category: 'color',
  tags: ['color', 'average', 'dominant', 'palette', 'kmeans'],
  keywords: ['average color', 'mean color', 'k-means colors', 'palette average', 'gamma correct average'],
  icon: 'PaintBucket',
  relatedTools: [],
};

export default meta;
