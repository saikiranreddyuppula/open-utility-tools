import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-merge-columns-v1',
  name: 'CSV Merge Columns',
  slug: 'csv-merge-columns',
  description:
    'Concatenate two or more CSV columns into a single column using a chosen separator and template.',
  category: 'data',
  tags: ['csv', 'merge', 'columns', 'concatenate', 'template'],
  keywords: ['csv merge', 'combine columns', 'concatenate csv', 'join columns', 'template column'],
  icon: 'Combine',
  relatedTools: [],
};

export default meta;
