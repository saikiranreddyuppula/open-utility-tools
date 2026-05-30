import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-sample-rows-v1',
  name: 'CSV Row Sampler',
  slug: 'csv-sample-rows',
  description: 'Extract the first N, last N, every Nth, or a random sample of rows from a CSV.',
  category: 'data',
  tags: ['csv', 'sample', 'rows', 'random', 'subset'],
  keywords: ['csv sample', 'head tail', 'every nth row', 'random sample', 'subset rows', 'seeded random'],
  icon: 'Filter',
  relatedTools: [],
};

export default meta;
