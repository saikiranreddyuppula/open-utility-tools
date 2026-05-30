import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-aspect-fit-cover-calculator-v1',
  name: 'Image Fit/Cover Box Calculator',
  slug: 'image-aspect-fit-cover-calculator',
  description:
    'Computes the rendered size and offsets for an image placed in a box with contain or cover fit.',
  category: 'image',
  tags: ['aspect', 'fit', 'cover', 'contain', 'object-fit'],
  keywords: [
    'object-fit calculator',
    'contain cover fill',
    'letterbox',
    'image scale offset',
    'background-size',
    'aspect ratio fit',
    'crop amount',
  ],
  icon: 'Scaling',
  relatedTools: [],
};

export default meta;
