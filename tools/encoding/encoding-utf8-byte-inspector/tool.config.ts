import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-utf8-byte-inspector-v1',
  name: 'UTF-8 Byte Inspector',
  slug: 'encoding-utf8-byte-inspector',
  description:
    'Break text into its UTF-8 byte sequence with per-character hex, binary, and code points.',
  category: 'encoding',
  tags: ['utf8', 'bytes', 'hex', 'binary', 'inspector'],
  keywords: [
    'utf-8',
    'byte',
    'hex',
    'binary',
    'code point',
    'encode',
    'decode',
    'textencoder',
  ],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
