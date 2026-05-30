import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-srcset-generator-v1',
  name: 'Responsive Image srcset Generator',
  slug: 'web-srcset-generator',
  description:
    'Generate <img> srcset/sizes (or <picture>) markup from a list of widths.',
  category: 'web',
  tags: ['srcset', 'responsive', 'images', 'html', 'picture'],
  keywords: [
    'responsive images',
    'srcset',
    'sizes',
    'picture',
    'webp',
    'avif',
    'density',
    'retina',
    'img tag',
  ],
  icon: 'Images',
  relatedTools: [],
};

export default meta;
