import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-ascii85-v1',
  name: 'Ascii85 / Base85 Encode',
  slug: 'ascii85',
  description: 'Encode and decode text using Ascii85 (Adobe variant).',
  category: 'encoding',
  tags: ['ascii85', 'base85', 'encode', 'decode', 'adobe'],
  keywords: ['ascii85', 'base85', 'btoa', 'encode', 'decode'],
  icon: 'Binary',
  relatedTools: ['base64-text', 'base58', 'hex-text'],
};

export default meta;
