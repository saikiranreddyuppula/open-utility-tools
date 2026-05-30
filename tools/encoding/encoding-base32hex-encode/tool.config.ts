import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-base32hex-encode-v1',
  name: 'Base32hex (Extended Hex) Encode / Decode',
  slug: 'encoding-base32hex-encode',
  description: 'Encode/decode using the RFC 4648 Base32hex extended-hex alphabet (0-9A-V).',
  category: 'encoding',
  tags: ['base32hex', 'rfc4648', 'dnssec', 'encode', 'decode'],
  keywords: [
    'base32hex',
    'extended hex',
    'rfc 4648',
    'nsec3',
    'dnssec',
    'sort order',
    'encode',
  ],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
