import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-slug-v1',
  name: 'Slug Generator',
  slug: 'generate-slug',
  description:
    'Turn each line of text into clean URL slugs with options for separator, lowercasing, accent stripping, and max length, processing many titles at once.',
  category: 'generators',
  tags: ['slug', 'url', 'seo'],
  keywords: ['slug', 'url', 'permalink', 'seo', 'kebab', 'friendly'],
  icon: 'Link2',
  relatedTools: [],
};

export default meta;
