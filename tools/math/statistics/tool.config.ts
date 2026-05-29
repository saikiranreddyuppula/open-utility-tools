import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-statistics-v1',
  name: 'Statistics Calculator',
  slug: 'statistics',
  description: 'Compute mean, median, range, variance and standard deviation of a data set.',
  category: 'math',
  tags: ['statistics', 'mean', 'median', 'stddev', 'variance'],
  keywords: ['statistics', 'mean', 'average', 'median', 'standard deviation', 'variance'],
  icon: 'BarChart3',
  relatedTools: ['percentage-calculator', 'gcd-lcm', 'number-base-converter'],
};

export default meta;
