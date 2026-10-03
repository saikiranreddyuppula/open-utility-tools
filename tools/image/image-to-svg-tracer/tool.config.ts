import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-to-svg-tracer-v1',
  name: 'Image to SVG (Vectorizer)',
  slug: 'image-to-svg-tracer',
  description:
    'Trace logos, icons, signatures and line art into clean SVG paths, in black and white or in up to 16 colours, with curve fitting and speckle removal.',
  category: 'image',
  tags: ['svg', 'vectorize', 'trace', 'logo', 'bitmap to vector', 'potrace'],
  keywords: [
    'png to svg',
    'jpg to svg',
    'raster to vector',
    'image tracer',
    'vectorizer',
    'autotrace',
    'potrace',
    'signature to svg',
    'logo to svg',
    'line art to svg',
    'bitmap tracing',
    'convert image to vector',
  ],
  icon: 'Spline',
  relatedTools: ['image-svg-optimizer-cleaner', 'image-threshold-bw', 'image-svg-to-png', 'image-converter'],
};

export default meta;
