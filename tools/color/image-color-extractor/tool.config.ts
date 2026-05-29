import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-image-color-extractor-v1',
  name: 'Image Color Extractor',
  slug: 'image-color-extractor',
  description:
    'Upload an image and extract its dominant colors and an automatic palette, ready to copy as HEX swatches.',
  category: 'color',
  tags: ['image', 'palette', 'swatch', 'color'],
  keywords: ['image', 'extract', 'dominant', 'palette', 'swatch', 'picker'],
  icon: 'Image',
  relatedTools: [],
};

export default meta;
