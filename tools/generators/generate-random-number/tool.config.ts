import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-random-number-v1',
  name: 'Random Number Generator',
  slug: 'generate-random-number',
  description:
    'Generate cryptographically random integers or decimals within a min/max range, with options for quantity, uniqueness, and number of decimal places.',
  category: 'generators',
  tags: ['random', 'number', 'rng'],
  keywords: ['random', 'number', 'integer', 'rng', 'range', 'dice'],
  icon: 'Dice5',
  relatedTools: [],
};

export default meta;
