import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-permutation-combination-v1',
  name: 'Permutations & Combinations Calculator',
  slug: 'permutation-combination',
  description: 'Compute nPr, nCr, and related counting values for n and r.',
  category: 'math',
  tags: ['permutations', 'combinations', 'counting', 'factorial', 'probability'],
  keywords: [
    'nPr',
    'nCr',
    'binomial coefficient',
    'with repetition',
    'without repetition',
    'multiset',
    'choose',
    'arrangements',
  ],
  icon: 'Shuffle',
  relatedTools: [],
};

export default meta;
