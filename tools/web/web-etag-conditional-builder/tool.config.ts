import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-etag-conditional-builder-v1',
  name: 'ETag & Conditional Request Builder',
  slug: 'web-etag-conditional-builder',
  description:
    'Generate ETag values and matching If-None-Match / If-Modified-Since request headers.',
  category: 'web',
  tags: ['etag', 'http', 'cache', 'conditional', 'headers', 'hash'],
  keywords: [
    'etag',
    'if-none-match',
    'if-modified-since',
    'last-modified',
    '304 not modified',
    'conditional request',
    'weak etag',
    'caching',
  ],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
