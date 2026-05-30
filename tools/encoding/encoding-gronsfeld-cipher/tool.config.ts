import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-gronsfeld-cipher-v1',
  name: 'Gronsfeld Cipher',
  slug: 'encoding-gronsfeld-cipher',
  description:
    'A Vigenere variant that uses a numeric key instead of a keyword.',
  category: 'encoding',
  tags: ['gronsfeld', 'cipher', 'vigenere', 'numeric-key', 'classical'],
  keywords: [
    'gronsfeld',
    'cipher',
    'vigenere',
    'numeric key',
    'polyalphabetic',
    'shift',
    'encrypt',
    'decrypt',
  ],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
