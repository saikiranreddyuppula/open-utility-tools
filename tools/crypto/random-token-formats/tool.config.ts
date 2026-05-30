import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-random-token-formats-v1',
  name: 'Random Token Generator (Formats)',
  slug: 'random-token-formats',
  description:
    'Generate cryptographically random tokens in many developer formats (hex, base64url, Base32, API-key style) with prefixes and grouping.',
  category: 'crypto',
  tags: ['token', 'random', 'api-key', 'secret', 'base64', 'hex'],
  keywords: [
    'random token',
    'api key',
    'secret key',
    'base64url',
    'base32',
    'crockford',
    'hex token',
    'access token',
    'sk_live',
    'entropy',
  ],
  icon: 'KeyRound',
  relatedTools: [],
};

export default meta;
