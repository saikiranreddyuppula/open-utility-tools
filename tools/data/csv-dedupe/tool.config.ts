import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-dedupe-v1',
  name: 'CSV Deduplicate Rows',
  slug: 'csv-dedupe',
  description: 'Remove duplicate rows from CSV, either fully identical or matching on selected key columns.',
  category: 'data',
  tags: ['csv', 'dedupe'],
  keywords: ['csv', 'duplicate', 'dedupe', 'unique', 'rows'],
  icon: 'Eraser',
  relatedTools: [],
};

export default meta;
