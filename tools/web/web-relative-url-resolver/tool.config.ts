import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-relative-url-resolver-v1',
  name: 'Relative URL Resolver',
  slug: 'web-relative-url-resolver',
  description:
    'Resolve a relative reference against a base URL to produce the absolute target.',
  category: 'web',
  tags: ['url', 'relative', 'resolve', 'base', 'absolute'],
  keywords: ['rfc 3986', 'reference resolution', 'href', 'dot segments', 'scheme relative'],
  icon: 'Navigation',
  relatedTools: [],
};

export default meta;
