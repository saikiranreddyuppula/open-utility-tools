import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-thumbnail-batch-v1',
  name: 'Batch Thumbnail Maker',
  slug: 'image-thumbnail-batch',
  description: 'Generate fixed-size cover/contain thumbnails from multiple images at once.',
  category: 'image',
  tags: ['thumbnail', 'batch', 'resize', 'crop', 'cover'],
  keywords: [
    'batch thumbnails',
    'cover crop',
    'contain fit',
    'resize many images',
    'square thumbnails',
    'bulk resize',
  ],
  icon: 'Images',
  relatedTools: [],
};

export default meta;
