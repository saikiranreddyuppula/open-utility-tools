import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-cagr-calculator-v1',
  name: 'CAGR Calculator',
  slug: 'cagr-calculator',
  description: 'Compute the compound annual growth rate between two values over time.',
  category: 'math',
  tags: ['cagr', 'finance', 'growth', 'investment', 'returns'],
  keywords: [
    'cagr',
    'compound annual growth rate',
    'growth rate',
    'doubling time',
    'rule of 72',
    'annualized return',
  ],
  icon: 'ChartLine',
  relatedTools: [],
};

export default meta;
