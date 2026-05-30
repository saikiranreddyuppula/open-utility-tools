import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-cors-headers-builder-v1',
  name: 'CORS Headers Builder',
  slug: 'web-cors-headers-builder',
  description:
    'Generate the Access-Control-* response headers for a desired cross-origin policy.',
  category: 'web',
  tags: ['http', 'cors', 'headers', 'security', 'api'],
  keywords: [
    'cors',
    'access-control-allow-origin',
    'preflight',
    'allow-credentials',
    'allow-methods',
    'cross-origin',
  ],
  icon: 'Globe2',
  relatedTools: [],
};

export default meta;
