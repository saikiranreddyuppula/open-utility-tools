import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-resize-to-filesize-v1',
  name: 'Resize to Target File Size',
  slug: 'image-resize-to-filesize',
  description:
    'Iteratively re-encode an image to land under a target KB limit (e.g. for upload limits).',
  category: 'image',
  tags: ['compress', 'filesize', 'target', 'upload', 'jpeg', 'webp'],
  keywords: [
    'resize to file size',
    'compress to kb',
    'target file size',
    'upload limit',
    'jpeg quality',
    'webp compress',
    'shrink image',
  ],
  icon: 'Gauge',
  relatedTools: [],
};

export default meta;
