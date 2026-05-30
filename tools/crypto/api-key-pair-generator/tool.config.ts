import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-api-key-pair-generator-v1',
  name: 'API Key + Secret Generator',
  slug: 'api-key-pair-generator',
  description: 'Generate matched public key ID and secret pairs with prefixes and a derived checksum.',
  category: 'crypto',
  tags: ['api-key', 'secret', 'generator', 'token', 'random'],
  keywords: ['public key', 'sk_', 'pk_', 'checksum', 'sha-256', 'base62', 'token'],
  icon: 'Key',
  relatedTools: [],
};

export default meta;
