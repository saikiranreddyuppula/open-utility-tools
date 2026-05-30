import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-a1z26-cipher-v1',
  name: 'A1Z26 Number Cipher',
  slug: 'a1z26-cipher',
  description:
    'Encode letters to their alphabet position numbers (A=1..Z=26) and decode numbers back to letters.',
  category: 'text',
  tags: ['cipher', 'puzzle', 'ctf', 'encode', 'decode'],
  keywords: [
    'a1z26',
    'letter to number',
    'number cipher',
    'alphabet position',
    'ctf',
    'puzzle cipher',
    'a=1',
  ],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
