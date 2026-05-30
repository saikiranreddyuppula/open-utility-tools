import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-z-score-calculator-v1',
  name: 'Z-Score Calculator',
  slug: 'z-score-calculator',
  description: 'Convert a raw value to a z-score and back given mean and standard deviation.',
  category: 'math',
  tags: ['statistics', 'z-score', 'normal', 'probability', 'percentile'],
  keywords: [
    'z-score',
    'standard score',
    'normal distribution',
    'percentile',
    'cumulative probability',
    'standard deviation',
    'mean',
    'cdf',
  ],
  icon: 'Gauge',
  relatedTools: [],
};

export default meta;
