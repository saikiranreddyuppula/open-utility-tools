import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-pivot-table-v1',
  name: 'CSV Pivot Table Builder',
  slug: 'csv-pivot-table',
  description:
    'Build a spreadsheet-style pivot table from CSV by choosing row, column, and value fields with an aggregation.',
  category: 'data',
  tags: ['csv', 'pivot', 'aggregate', 'table', 'summary'],
  keywords: ['pivot table', 'csv pivot', 'group by', 'crosstab', 'aggregate sum count average'],
  icon: 'TableProperties',
  relatedTools: [],
};

export default meta;
