import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-sort-v1',
  name: 'CSV Sorter',
  slug: 'csv-sort',
  description: 'Sort CSV rows by a chosen column with numeric/text mode and ascending or descending order.',
  category: 'data',
  tags: ['csv', 'sort'],
  keywords: ['csv', 'sort', 'rows', 'order', 'column'],
  icon: 'SortAsc',
  relatedTools: [],
};

export default meta;
