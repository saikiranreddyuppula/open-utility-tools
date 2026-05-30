import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-http-cache-header-explainer-v1',
  name: 'Cache-Control Header Explainer',
  slug: 'web-http-cache-header-explainer',
  description: 'Break down a Cache-Control header and explain each directive and its effect.',
  category: 'web',
  tags: ['http', 'cache', 'headers', 'cache-control', 'explain'],
  keywords: ['cache-control', 'max-age', 'no-store', 'immutable', 'http caching', 's-maxage'],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
