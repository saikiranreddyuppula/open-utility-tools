import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-url-normalizer-v1',
  name: 'URL Normalizer',
  slug: 'web-url-normalizer',
  description:
    'Canonicalize a URL by lowercasing host, resolving dot segments, sorting params, and stripping defaults.',
  category: 'web',
  tags: ['url', 'normalize', 'canonical', 'query', 'rfc 3986'],
  keywords: ['canonicalize', 'sort params', 'dedupe', 'trailing slash', 'default port', 'cleanup'],
  icon: 'Route',
  relatedTools: [],
};

export default meta;
