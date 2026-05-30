import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-palette-extractor-v1',
  name: 'Image Palette Extractor',
  slug: 'image-palette-extractor',
  description: 'Extract a balanced N-color palette from an image via median-cut quantization.',
  category: 'image',
  tags: ['palette', 'colors', 'median-cut', 'quantization', 'swatches'],
  keywords: [
    'palette',
    'color palette',
    'median cut',
    'dominant colors',
    'extract colors',
    'css variables',
    'color scheme',
  ],
  icon: 'Palette',
  relatedTools: [],
};

export default meta;
