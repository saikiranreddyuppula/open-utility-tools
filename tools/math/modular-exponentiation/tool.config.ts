import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-modular-exponentiation-v1',
  name: 'Modular Exponentiation Calculator',
  slug: 'modular-exponentiation',
  description:
    'Compute (base^exponent) mod m efficiently for very large numbers using fast square-and-multiply.',
  category: 'math',
  tags: ['modular', 'exponentiation', 'cryptography', 'rsa', 'bigint'],
  keywords: [
    'modular exponentiation',
    'modpow',
    'square and multiply',
    'rsa',
    'cryptography',
    'power mod',
  ],
  icon: 'Superscript',
  relatedTools: [],
};

export default meta;
