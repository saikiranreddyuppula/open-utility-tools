import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-repeating-decimal-to-fraction-v1',
  name: 'Repeating Decimal to Fraction',
  slug: 'repeating-decimal-to-fraction',
  description: 'Turn a repeating decimal like 0.1(6) into its exact fraction using the 9s-denominator method.',
  category: 'math',
  tags: ['fraction', 'decimal', 'repeating', 'recurring', 'conversion'],
  keywords: [
    'repeating decimal',
    'recurring decimal',
    'fraction',
    'vinculum',
    'overline',
    'rational',
    'nines denominator',
    'exact fraction',
  ],
  icon: 'Repeat',
  relatedTools: [],
};

export default meta;
