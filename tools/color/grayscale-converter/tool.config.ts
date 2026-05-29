import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-grayscale-converter-v1',
  name: 'Grayscale Converter',
  slug: 'grayscale-converter',
  description:
    'Convert any color to its grayscale equivalent using luminance, average, or desaturation methods, with side-by-side preview.',
  category: 'color',
  tags: ['grayscale', 'desaturate', 'luminance'],
  keywords: ['grayscale', 'greyscale', 'desaturate', 'luminance', 'black and white'],
  icon: 'Eye',
  relatedTools: [],
};

export default meta;
