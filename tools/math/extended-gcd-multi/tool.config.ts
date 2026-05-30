import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-extended-gcd-multi-v1',
  name: 'Multi-Number GCD & LCM',
  slug: 'extended-gcd-multi',
  description: 'Compute the GCD and LCM of an arbitrary list of integers with the Bezout combination.',
  category: 'math',
  tags: ['gcd', 'lcm', 'euclid', 'bezout', 'number-theory'],
  keywords: ['greatest common divisor', 'least common multiple', 'coprime', 'extended euclid', 'divisor'],
  icon: 'Combine',
  relatedTools: [],
};

export default meta;
