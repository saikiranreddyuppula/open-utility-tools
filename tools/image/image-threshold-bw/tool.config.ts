import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-threshold-bw-v1',
  name: 'Black & White Threshold',
  slug: 'image-threshold-bw',
  description: 'Convert an image to pure 1-bit black and white using a luminance threshold or dithering.',
  category: 'image',
  tags: ['threshold', 'dither', 'monochrome', 'binary', 'filter'],
  keywords: [
    'black and white',
    '1-bit',
    'floyd steinberg',
    'dithering',
    'e-ink',
    'thermal printer',
  ],
  icon: 'Contrast',
  relatedTools: [],
};

export default meta;
