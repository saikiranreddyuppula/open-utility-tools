import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-add-row-numbers-v1',
  name: 'CSV Add Row Numbers',
  slug: 'csv-add-row-numbers',
  description:
    'Prepend or append a sequential ID / row-number column to a CSV with a configurable start, step, padding, and prefix/suffix.',
  category: 'data',
  tags: ['csv', 'row-number', 'id', 'index', 'sequence'],
  keywords: [
    'csv row numbers',
    'add id column',
    'sequence column',
    'auto increment',
    'index column',
    'numbering',
    'zero pad',
  ],
  icon: 'ListOrdered',
  relatedTools: [],
};

export default meta;
