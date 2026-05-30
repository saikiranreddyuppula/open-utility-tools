import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-base64url-jwk-encoder-v1',
  name: 'Base64url JWK Field Encoder',
  slug: 'base64url-jwk-encoder',
  description: 'Convert between Base64url and big-integer/byte values for hand-editing JWK fields.',
  category: 'crypto',
  tags: ['jwk', 'base64url', 'bigint', 'jose', 'encoding'],
  keywords: ['jwk', 'base64url', 'rfc 4648', 'big integer', 'jose', 'modulus exponent', 'n e x y d'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
