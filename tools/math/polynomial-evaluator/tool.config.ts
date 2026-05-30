import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-polynomial-evaluator-v1',
  name: 'Polynomial Evaluator (Horner)',
  slug: 'polynomial-evaluator',
  description: "Evaluate a polynomial at a value and get its derivative via Horner's method.",
  category: 'math',
  tags: ['polynomial', 'horner', 'derivative', 'algebra', 'evaluate'],
  keywords: [
    'horner method',
    'evaluate polynomial',
    'polynomial derivative',
    'coefficients',
    'P(x)',
    "P'(x)",
    'synthetic division',
  ],
  icon: 'SquareFunction',
  relatedTools: [],
};

export default meta;
