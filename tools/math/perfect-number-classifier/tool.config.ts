import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-perfect-number-classifier-v1',
  name: 'Perfect / Abundant / Deficient Classifier',
  slug: 'perfect-number-classifier',
  description:
    'Classify a number as perfect, abundant, or deficient and explore related number types.',
  category: 'math',
  tags: ['perfect', 'abundant', 'deficient', 'divisors', 'number-theory'],
  keywords: [
    'aliquot sum',
    'proper divisors',
    'perfect number',
    'abundant number',
    'deficient number',
    'amicable',
    'semiprime',
    'harshad',
    'triangular',
    'fibonacci',
  ],
  icon: 'Award',
  relatedTools: [],
};

export default meta;
