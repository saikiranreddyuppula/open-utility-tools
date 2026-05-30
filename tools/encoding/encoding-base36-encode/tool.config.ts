import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-base36-encode-v1',
  name: 'Base36 Encode / Decode',
  slug: 'encoding-base36-encode',
  description: 'Convert between arbitrary-length integers and Base36 (0-9, a-z) strings.',
  category: 'encoding',
  tags: ['base36', 'bigint', 'radix', 'encode', 'decode'],
  keywords: [
    'base36',
    'base 36',
    'radix 36',
    'bigint',
    'alphanumeric',
    'encode',
    'decode',
  ],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
