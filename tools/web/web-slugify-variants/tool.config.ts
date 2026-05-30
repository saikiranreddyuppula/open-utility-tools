import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-slugify-variants-v1',
  name: 'Slugify Variants Comparator',
  slug: 'web-slugify-variants',
  description:
    'Generate multiple slug styles (kebab, snake, dot, path, GitHub-anchor) from one input at once for comparison.',
  category: 'web',
  tags: ['slug', 'slugify', 'kebab', 'snake', 'anchor'],
  keywords: ['url slug', 'dot case', 'path case', 'github heading', 'filename safe', 'diacritics'],
  icon: 'Link',
  relatedTools: [],
};

export default meta;
