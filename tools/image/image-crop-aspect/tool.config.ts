import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-crop-aspect-v1',
  name: 'Crop to Aspect Ratio',
  slug: 'image-crop-aspect',
  description:
    'Crop an image to a chosen aspect ratio (1:1, 4:3, 16:9, custom) with center/anchor control.',
  category: 'image',
  tags: ['crop', 'aspect ratio', 'resize', 'thumbnail', 'square'],
  keywords: [
    'crop image',
    'aspect ratio',
    'square crop',
    '16:9',
    'thumbnail crop',
    'anchor',
  ],
  icon: 'Crop',
  relatedTools: [],
};

export default meta;
