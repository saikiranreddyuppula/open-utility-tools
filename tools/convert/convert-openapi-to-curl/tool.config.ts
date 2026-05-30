import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-convert-openapi-to-curl-v1',
  name: 'OpenAPI Paths to cURL',
  slug: 'convert-openapi-to-curl',
  description: 'Turn OpenAPI path operations into example cURL commands with placeholder values.',
  category: 'convert',
  tags: ['openapi', 'swagger', 'curl', 'api', 'rest'],
  keywords: ['openapi to curl', 'swagger to curl', 'api examples', 'endpoints', 'paths', 'operations'],
  icon: 'Send',
  relatedTools: [],
};

export default meta;
