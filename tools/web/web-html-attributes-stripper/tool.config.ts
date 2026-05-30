import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-html-attributes-stripper-v1',
  name: 'HTML Attribute Stripper / Tag Cleaner',
  slug: 'web-html-attributes-stripper',
  description: 'Remove selected attributes (style, class, on*, data-*) or whole tags from HTML.',
  category: 'web',
  tags: ['html', 'sanitize', 'clean', 'strip', 'attributes'],
  keywords: ['remove style', 'strip class', 'clean html', 'sanitize paste', 'remove tags', 'data attributes'],
  icon: 'Eraser',
  relatedTools: [],
};

export default meta;
