import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-png-compressor-v1',
  name: 'PNG Compressor',
  slug: 'image-png-compressor',
  description:
    'Shrink PNG files up to 80% with TinyPNG-style palette quantization or lossless re-encoding — batch, side-by-side preview and ZIP download, all in your browser.',
  category: 'image',
  tags: ['png', 'compress', 'optimize', 'quantize', 'batch'],
  keywords: [
    'tinypng',
    'pngquant',
    'optipng',
    'reduce png size',
    'png optimizer',
    'palette quantization',
    'lossless png',
    'compress images',
  ],
  icon: 'Minimize2',
  relatedTools: ['image-compress-quality', 'image-converter', 'image-resize-to-filesize'],
};

export default meta;
