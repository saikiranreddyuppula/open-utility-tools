import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-gcd-lcm-v1',
  name: 'GCD & LCM Calculator',
  slug: 'gcd-lcm',
  description: 'Find the greatest common divisor and least common multiple of numbers.',
  category: 'math',
  tags: ['gcd', 'lcm', 'divisor', 'multiple', 'factor'],
  keywords: ['gcd', 'lcm', 'greatest common divisor', 'least common multiple', 'hcf'],
  icon: 'Sigma',
  relatedTools: ['prime-checker', 'percentage-calculator', 'number-base-converter'],
};

export default meta;
