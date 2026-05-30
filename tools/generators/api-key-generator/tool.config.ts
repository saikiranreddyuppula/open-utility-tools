import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-api-key-generator-v1',
  name: 'API Key Generator',
  slug: 'api-key-generator',
  description: 'Generate prefixed, secret-style API keys in common SaaS formats.',
  category: 'generators',
  tags: ['api-key', 'secret', 'token', 'random', 'generator'],
  keywords: ['api key', 'secret key', 'token generator', 'stripe key', 'github token', 'base62'],
  icon: 'Key',
  relatedTools: [],
};

export default meta;
