import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-playfair-cipher-v1',
  name: 'Playfair Cipher',
  slug: 'encoding-playfair-cipher',
  description:
    'Encrypt and decrypt with the classic 5x5 Playfair digraph substitution cipher.',
  category: 'encoding',
  tags: ['playfair', 'cipher', 'digraph', 'classical', 'key-square'],
  keywords: [
    'playfair cipher',
    'digraph',
    'bigram',
    'key square',
    'keyword',
    'i/j merge',
    'encrypt',
    'decrypt',
  ],
  icon: 'Grid3x3',
  relatedTools: [],
};

export default meta;
