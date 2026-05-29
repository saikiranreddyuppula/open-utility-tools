import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-converter-v1',
  name: 'Image Converter',
  slug: 'image-converter',
  description:
    'Convert images between PNG, JPEG, WebP, GIF, BMP, TIFF and ICO — resize, set quality, batch & zip. All in your browser.',
  category: 'image',
  tags: ['convert', 'png', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'resize'],
  keywords: ['image converter', 'png to jpg', 'webp', 'resize image', 'ico', 'favicon', 'batch'],
  icon: 'ImageDown',
  relatedTools: ['image-to-base64', 'hash-text', 'base64-text'],
  loadWasm: true,
};

export default meta;
