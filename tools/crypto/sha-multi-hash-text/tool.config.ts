import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-sha-multi-hash-text-v1',
  name: 'SHA Multi-Hash (Text)',
  slug: 'sha-multi-hash-text',
  description:
    'Compute SHA-1, SHA-256, SHA-384, and SHA-512 digests of pasted text simultaneously.',
  category: 'crypto',
  tags: ['sha', 'hash', 'digest', 'checksum', 'sha256'],
  keywords: ['sha1', 'sha384', 'sha512', 'base64', 'hex', 'fingerprint'],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
