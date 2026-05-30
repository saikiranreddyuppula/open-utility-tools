import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-base16-encode-v1',
  name: 'Base16 Encode / Decode',
  slug: 'encoding-base16-encode',
  description:
    'Encode text to uppercase Base16 (RFC 4648 hex) and decode it back, with strict validation.',
  category: 'encoding',
  tags: ['base16', 'hex', 'rfc4648', 'encode', 'decode'],
  keywords: [
    'base16',
    'hexadecimal',
    'hex',
    'rfc 4648',
    'encode',
    'decode',
    'bytes',
  ],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
