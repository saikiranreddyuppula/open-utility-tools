import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-crypto-key-fingerprint-v1',
  name: 'Key Fingerprint Generator',
  slug: 'crypto-key-fingerprint',
  description: 'Compute SSH-style and certificate-style fingerprints of a public key (MD5 colon-hex and SHA-256 base64).',
  category: 'crypto',
  tags: ['ssh', 'fingerprint', 'public key', 'md5', 'sha256'],
  keywords: ['ssh fingerprint', 'sha256 base64', 'md5 colon hex', 'authorized_keys', 'pem spki', 'jwk'],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
