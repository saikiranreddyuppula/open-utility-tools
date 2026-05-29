import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-rot13-v1',
  name: 'ROT13 / Caesar Cipher',
  slug: 'rot13',
  description: 'Apply ROT13 or a Caesar shift cipher to text (reversible).',
  category: 'text',
  tags: ['rot13', 'caesar', 'cipher', 'shift', 'rotate'],
  keywords: ['rot13', 'caesar cipher', 'shift cipher', 'rotate letters', 'encode'],
  icon: 'Shuffle',
  relatedTools: ['morse-code', 'base64-text', 'case-converter'],
};

export default meta;
