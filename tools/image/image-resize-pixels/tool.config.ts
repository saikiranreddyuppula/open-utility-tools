import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-resize-pixels-v1',
  name: 'Image Resizer (Pixels & Percent)',
  slug: 'image-resize-pixels',
  description:
    'Resize an image to exact pixel dimensions or by percentage, with optional aspect-lock.',
  category: 'image',
  tags: ['resize', 'scale', 'dimensions', 'pixels', 'percent', 'aspect'],
  keywords: [
    'resize image',
    'scale image',
    'image dimensions',
    'aspect ratio lock',
    'resize percent',
    'png jpeg export',
  ],
  icon: 'Scaling',
  relatedTools: [],
};

export default meta;
