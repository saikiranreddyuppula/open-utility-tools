import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-modular-inverse-v1',
  name: 'Modular Multiplicative Inverse',
  slug: 'modular-inverse',
  description: 'Find x such that a*x ≡ 1 (mod m) using the extended Euclidean algorithm.',
  category: 'math',
  tags: ['modular', 'inverse', 'number-theory', 'euclidean', 'cryptography'],
  keywords: ['mod inverse', 'modular arithmetic', 'extended euclid', 'bezout', 'gcd', 'rsa'],
  icon: 'Equal',
  relatedTools: [],
};

export default meta;
