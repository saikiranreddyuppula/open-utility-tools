import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-caesar-cipher-v1',
  name: 'Caesar Cipher Shift',
  slug: 'encoding-caesar-cipher',
  description:
    'Encode or decode text with a configurable Caesar shift, rotating letters by any amount while preserving case and symbols.',
  category: 'encoding',
  tags: ['caesar', 'cipher', 'shift'],
  keywords: ['caesar', 'cipher', 'shift', 'rotate', 'encode', 'decode'],
  icon: 'RotateCw',
  relatedTools: [],
};

export default meta;
