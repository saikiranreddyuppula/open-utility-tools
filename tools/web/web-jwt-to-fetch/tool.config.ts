import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-jwt-to-fetch-v1',
  name: 'Authenticated fetch() Builder',
  slug: 'web-jwt-to-fetch',
  description:
    'Generate a fetch() snippet with method, headers, bearer token, and JSON body.',
  category: 'web',
  tags: ['fetch', 'http', 'javascript', 'api', 'bearer'],
  keywords: [
    'fetch',
    'http request',
    'bearer token',
    'authorization',
    'api',
    'javascript',
    'snippet',
    'json body',
  ],
  icon: 'Code2',
  relatedTools: [],
};

export default meta;
