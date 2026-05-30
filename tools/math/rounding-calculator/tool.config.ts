import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-rounding-calculator-v1',
  name: 'Rounding & Significant Figures',
  slug: 'rounding-calculator',
  description: 'Round numbers by decimals, significant figures, or a chosen rule.',
  category: 'math',
  tags: ['rounding', 'significant figures', 'precision', 'decimals', 'math'],
  keywords: [
    'rounding',
    'significant figures',
    'sig figs',
    'bankers rounding',
    'half even',
    'half up',
    'ceil',
    'floor',
    'truncate',
    'nearest multiple',
  ],
  icon: 'Calculator',
  relatedTools: [],
};

export default meta;
