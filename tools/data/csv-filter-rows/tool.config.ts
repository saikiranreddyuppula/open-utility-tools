import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-filter-rows-v1',
  name: 'CSV Row Filter',
  slug: 'csv-filter-rows',
  description:
    'Keep or drop CSV rows that match conditions on chosen columns (equals, contains, regex, numeric ranges).',
  category: 'data',
  tags: ['csv', 'filter', 'rows', 'conditions', 'query'],
  keywords: ['csv filter', 'where clause', 'grep csv', 'row condition', 'numeric range', 'regex filter'],
  icon: 'ListFilter',
  relatedTools: [],
};

export default meta;
