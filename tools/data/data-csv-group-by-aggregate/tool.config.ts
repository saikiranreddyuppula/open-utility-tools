import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-csv-group-by-aggregate-v1',
  name: 'CSV Group-By Aggregator',
  slug: 'data-csv-group-by-aggregate',
  description: 'Group CSV rows by a column and compute count, sum, avg, min, and max on another.',
  category: 'data',
  tags: ['csv', 'group-by', 'aggregate', 'sql'],
  keywords: ['csv', 'group by', 'aggregate', 'sum', 'count', 'average', 'mean', 'min', 'max', 'pivot'],
  icon: 'ChartBar',
  relatedTools: [],
};

export default meta;
