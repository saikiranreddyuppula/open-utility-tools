import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-tap-code-cipher-v1',
  name: 'Tap Code Cipher',
  slug: 'tap-code-cipher',
  description:
    'Encode text into Polybius-square tap code (rows.columns) and decode tap sequences back to letters.',
  category: 'text',
  tags: ['text', 'cipher', 'encode', 'decode'],
  keywords: [
    'tap code',
    'polybius',
    'prisoner',
    'pow',
    'cipher',
    'knock code',
    'encode',
    'decode',
  ],
  icon: 'Grid3x3',
  relatedTools: [],
};

export default meta;
