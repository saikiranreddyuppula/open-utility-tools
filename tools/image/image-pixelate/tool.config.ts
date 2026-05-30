import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-pixelate-v1',
  name: 'Pixelate / Mosaic',
  slug: 'image-pixelate',
  description:
    'Pixelate an image (or simulate censoring) with an adjustable block size.',
  category: 'image',
  tags: ['pixelate', 'mosaic', 'censor', 'blur', 'block', 'privacy'],
  keywords: [
    'pixelate image',
    'mosaic',
    'censor',
    'blur face',
    'block size',
    'redact',
    'nearest neighbor',
  ],
  icon: 'Grid3x3',
  relatedTools: [],
};

export default meta;
