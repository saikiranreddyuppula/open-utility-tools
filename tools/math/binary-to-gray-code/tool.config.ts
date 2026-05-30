import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-binary-to-gray-code-v1',
  name: 'Binary ↔ Gray Code Converter',
  slug: 'binary-to-gray-code',
  description: 'Convert between standard binary and reflected Gray code at any bit width.',
  category: 'math',
  tags: ['gray code', 'binary', 'encoding', 'bits', 'converter'],
  keywords: [
    'gray code',
    'binary to gray',
    'gray to binary',
    'reflected binary',
    'rotary encoder',
    'karnaugh',
  ],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
