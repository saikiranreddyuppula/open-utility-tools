import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-rotate-flip-v1',
  name: 'Rotate & Flip Image',
  slug: 'image-rotate-flip',
  description:
    'Rotate an image 90/180/270 degrees or by a free angle and flip horizontally/vertically.',
  category: 'image',
  tags: ['rotate', 'flip', 'mirror', 'angle', 'orientation', 'transform'],
  keywords: [
    'rotate image',
    'flip image',
    'mirror image',
    'free angle rotation',
    'orientation fix',
    'horizontal vertical flip',
  ],
  icon: 'RotateCw',
  relatedTools: [],
};

export default meta;
