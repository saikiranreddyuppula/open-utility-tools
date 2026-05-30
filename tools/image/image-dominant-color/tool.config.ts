import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-dominant-color-v1',
  name: 'Dominant & Average Color',
  slug: 'image-dominant-color',
  description:
    'Extract the single dominant color and the average color of an image as hex/RGB.',
  category: 'image',
  tags: ['color', 'dominant', 'average', 'extract', 'swatch'],
  keywords: [
    'dominant color',
    'average color',
    'color picker',
    'hex from image',
    'image color',
  ],
  icon: 'Pipette',
  relatedTools: [],
};

export default meta;
