import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-slugify-v1',
  name: 'Slugify',
  slug: 'slugify',
  description: 'Turn any text into a clean, URL-safe slug.',
  category: 'text',
  tags: ['slug', 'url', 'permalink', 'kebab'],
  keywords: ['slug', 'url safe', 'permalink', 'seo', 'kebab'],
  icon: 'Link2',
  relatedTools: ['case-converter', 'url-encode', 'json-formatter'],
};

export default meta;
