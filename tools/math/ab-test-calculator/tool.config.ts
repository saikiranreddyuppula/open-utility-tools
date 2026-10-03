import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-ab-test-calculator-v1',
  name: 'A/B Test Significance & Sample Size Calculator',
  slug: 'ab-test-calculator',
  description:
    'Check whether an A/B test result is statistically significant (z-test, Fisher exact, Bayesian) and plan the sample size and duration of a test.',
  category: 'math',
  tags: ['ab testing', 'statistics', 'conversion', 'significance', 'sample size'],
  keywords: [
    'ab test calculator',
    'split test',
    'statistical significance',
    'conversion rate',
    'two proportion z-test',
    'fisher exact test',
    'bayesian ab test',
    'sample size calculator',
    'minimum detectable effect',
    'power analysis',
    'wilson interval',
    'cro',
  ],
  icon: 'FlaskConical',
  relatedTools: ['probability-distribution-calculator', 'z-score-calculator', 'percent-change', 'statistics'],
};

export default meta;
