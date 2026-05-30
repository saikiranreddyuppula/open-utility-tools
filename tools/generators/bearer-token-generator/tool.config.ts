import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-bearer-token-generator-v1',
  name: 'Random Token Generator',
  slug: 'bearer-token-generator',
  description: 'Generate cryptographically random tokens encoded as hex, Base64, Base64URL, or Base62.',
  category: 'generators',
  tags: ['token', 'bearer', 'random', 'api-key', 'secret', 'crypto'],
  keywords: ['bearer token', 'api token', 'access token', 'secret', 'base62', 'base64url', 'hex token', 'random token'],
  icon: 'Vault',
  relatedTools: [],
};

export default meta;
