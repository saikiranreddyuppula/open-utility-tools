import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-linear-regression-calculator-v1',
  name: 'Linear Regression & Correlation Calculator',
  slug: 'linear-regression-calculator',
  description:
    'Fit linear, polynomial, exponential, logarithmic and power models to your data with full statistics, correlation coefficients, predictions and a chart.',
  category: 'math',
  tags: ['regression', 'correlation', 'statistics', 'curve fitting', 'least squares'],
  keywords: [
    'linear regression',
    'least squares',
    'line of best fit',
    'trendline',
    'r squared',
    'pearson correlation',
    'spearman',
    'kendall tau',
    'polynomial regression',
    'exponential regression',
    'power regression',
    'confidence interval',
    'prediction interval',
    'residual plot',
    'scatter plot',
  ],
  icon: 'TrendingUp',
  relatedTools: ['statistics', 'standard-deviation-variance', 'z-score-calculator', 'probability-distribution-calculator'],
};

export default meta;
