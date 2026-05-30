import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-bearer-auth-header-builder-v1',
  name: 'Authorization Header Builder',
  slug: 'web-bearer-auth-header-builder',
  description:
    'Construct Authorization header values for Bearer, Basic, API key, and custom schemes.',
  category: 'web',
  tags: ['http', 'auth', 'header', 'bearer', 'basic'],
  keywords: [
    'authorization header',
    'bearer token',
    'basic auth',
    'api key',
    'curl header',
    'fetch headers',
    'http auth',
  ],
  icon: 'KeyRound',
  relatedTools: [],
};

export default meta;
