import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-compress-quality-v1',
  name: 'JPEG/WebP Compressor',
  slug: 'image-compress-quality',
  description:
    'Reduce image file size with a quality slider and live before/after byte comparison.',
  category: 'image',
  tags: ['compress', 'jpeg', 'webp', 'optimize', 'quality'],
  keywords: [
    'image compression',
    'reduce file size',
    'jpeg quality',
    'webp encode',
    'optimize photo',
  ],
  icon: 'ImageDown',
  relatedTools: [],
};

export default meta;
