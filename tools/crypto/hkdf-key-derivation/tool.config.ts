import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-hkdf-key-derivation-v1',
  name: 'HKDF Key Derivation',
  slug: 'hkdf-key-derivation',
  description: 'Expand input key material into one or more output keys using HKDF (RFC 5869).',
  category: 'crypto',
  tags: ['hkdf', 'kdf', 'key-derivation', 'rfc-5869', 'sha'],
  keywords: ['hkdf', 'key derivation', 'rfc 5869', 'extract expand', 'derive key', 'sha-256', 'okm', 'ikm'],
  icon: 'Key',
  relatedTools: [],
};

export default meta;
