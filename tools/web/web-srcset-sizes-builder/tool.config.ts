import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-srcset-sizes-builder-v1',
  name: 'Responsive Image srcset Builder',
  slug: 'web-srcset-sizes-builder',
  description:
    'Builds an <img> srcset and sizes attribute from a base filename and width list.',
  category: 'web',
  tags: ['srcset', 'sizes', 'responsive', 'breakpoints', 'html'],
  keywords: [
    'srcset',
    'sizes attribute',
    'breakpoints',
    'responsive images',
    'media query',
    'width descriptor',
    'img tag',
    'lazy loading',
  ],
  icon: 'Image',
  relatedTools: [],
};

export default meta;
