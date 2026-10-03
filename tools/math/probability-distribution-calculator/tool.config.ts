import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-probability-distribution-calculator-v1',
  name: 'Probability Distribution Calculator',
  slug: 'probability-distribution-calculator',
  description:
    'Compute CDF, tail and interval probabilities, densities, quantiles, critical values and p-values for 14 common distributions with a shaded chart.',
  category: 'math',
  tags: ['probability', 'statistics', 'distribution', 'p-value', 'quantile'],
  keywords: [
    'normal distribution',
    'student t',
    'chi-square',
    'f distribution',
    'binomial',
    'poisson',
    'critical value',
    'p-value calculator',
    'inverse cdf',
    'quantile',
    'z table',
    'hypergeometric',
    'gamma',
    'beta',
    'exponential',
  ],
  icon: 'ChartLine',
  relatedTools: ['z-score-calculator', 'dice-probability', 'statistics', 'random-distribution-generator'],
};

export default meta;
