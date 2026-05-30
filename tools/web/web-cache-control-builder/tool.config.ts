import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-cache-control-builder-v1',
  name: 'Cache-Control Builder',
  slug: 'web-cache-control-builder',
  description:
    'Compose and explain a Cache-Control header from caching directive checkboxes and durations.',
  category: 'web',
  tags: ['http', 'cache', 'headers', 'cdn', 'performance'],
  keywords: [
    'cache-control',
    'max-age',
    's-maxage',
    'no-store',
    'immutable',
    'stale-while-revalidate',
    'http header',
  ],
  icon: 'Clock3',
  relatedTools: [],
};

export default meta;
