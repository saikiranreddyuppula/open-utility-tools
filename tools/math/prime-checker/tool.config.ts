import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-prime-checker-v1',
  name: 'Prime Checker & Factorizer',
  slug: 'prime-checker',
  description: 'Check whether a number is prime and view its prime factorization.',
  category: 'math',
  tags: ['prime', 'factor', 'factorization', 'number'],
  keywords: ['prime', 'is prime', 'prime factors', 'factorization', 'composite'],
  icon: 'Sigma',
  relatedTools: ['gcd-lcm', 'number-base-converter', 'statistics'],
};

export default meta;
