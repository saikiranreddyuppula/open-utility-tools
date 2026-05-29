import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-caesar-cipher-v1',
  name: 'Caesar Cipher',
  slug: 'caesar-cipher',
  description:
    'Encode or decode text with a Caesar cipher of any shift amount, the classic reversible letter rotation, with optional brute-force of all 25 shifts.',
  category: 'text',
  tags: ['caesar', 'cipher', 'shift', 'encrypt'],
  keywords: ['caesar', 'cipher', 'shift', 'encrypt', 'decode'],
  icon: 'RotateCw',
  relatedTools: [],
};

export default meta;
