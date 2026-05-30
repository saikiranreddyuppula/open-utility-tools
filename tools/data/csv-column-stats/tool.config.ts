import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-column-stats-v1',
  name: 'CSV Column Statistics',
  slug: 'csv-column-stats',
  description:
    'Compute per-column statistics (type, count, nulls, distinct, min/max, mean, median, std-dev) for every column in a CSV.',
  category: 'data',
  tags: ['csv', 'statistics', 'profiling', 'summary', 'analytics'],
  keywords: [
    'csv stats',
    'column profiling',
    'describe',
    'data summary',
    'mean median',
    'standard deviation',
    'distinct count',
    'data quality',
  ],
  icon: 'ChartBar',
  relatedTools: [],
};

export default meta;
