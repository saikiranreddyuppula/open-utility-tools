import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-histogram-v1',
  name: 'Image Histogram',
  slug: 'image-histogram',
  description: 'Plot RGB and luminance histograms of an image on a canvas.',
  category: 'image',
  tags: ['histogram', 'rgb', 'luminance', 'analysis', 'levels'],
  keywords: [
    'histogram',
    'rgb histogram',
    'luminance',
    'tonal range',
    'image levels',
    'clipping',
    'photo analysis',
  ],
  icon: 'BarChart3',
  relatedTools: [],
};

export default meta;
