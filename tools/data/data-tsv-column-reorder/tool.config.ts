import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-tsv-column-reorder-v1',
  name: 'Delimited Column Reorder',
  slug: 'data-tsv-column-reorder',
  description:
    'Reorders, drops, or duplicates columns in CSV/TSV data by index or header name.',
  category: 'data',
  tags: ['csv', 'tsv', 'columns', 'reorder', 'delimited'],
  keywords: [
    'rearrange columns',
    'select columns',
    'drop column',
    'duplicate column',
    'column order',
    'csv projection',
  ],
  icon: 'Columns3',
  relatedTools: [],
};

export default meta;
