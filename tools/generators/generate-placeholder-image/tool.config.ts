import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-placeholder-image-v1',
  name: 'Placeholder Image Generator',
  slug: 'generate-placeholder-image',
  description:
    'Generate downloadable placeholder images at a chosen size, background/text color, and label text, drawn on a canvas as a data URL for mockups.',
  category: 'generators',
  tags: ['placeholder', 'image', 'generator'],
  keywords: ['placeholder', 'image', 'mockup', 'canvas', 'dummy', 'thumbnail'],
  icon: 'FileImage',
  relatedTools: [],
};

export default meta;
