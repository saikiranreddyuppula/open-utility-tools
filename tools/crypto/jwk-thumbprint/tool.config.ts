import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-jwk-thumbprint-v1',
  name: 'JWK Thumbprint (RFC 7638)',
  slug: 'jwk-thumbprint',
  description: 'Compute the canonical SHA-256 thumbprint of a JSON Web Key per RFC 7638.',
  category: 'crypto',
  tags: ['jwk', 'thumbprint', 'rfc7638', 'hash', 'fingerprint'],
  keywords: ['jwk thumbprint', 'kid', 'canonical', 'sha-256', 'base64url', 'key id'],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
