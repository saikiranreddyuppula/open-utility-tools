import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-http-headers-reference-v1',
  name: 'HTTP Headers Reference',
  slug: 'web-http-headers-reference',
  description:
    'Look up any HTTP request or response header to see its purpose, direction, example values, and whether it is standard or deprecated.',
  category: 'web',
  tags: ['http', 'headers', 'reference'],
  keywords: ['http', 'headers', 'reference', 'request', 'response', 'lookup'],
  icon: 'Network',
  relatedTools: [],
};

export default meta;
