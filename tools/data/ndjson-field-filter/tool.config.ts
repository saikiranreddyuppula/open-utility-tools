import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-ndjson-field-filter-v1',
  name: 'NDJSON Field Filter',
  slug: 'ndjson-field-filter',
  description: 'Select, drop, or rename fields across NDJSON records.',
  category: 'data',
  tags: ['ndjson', 'jsonl', 'filter', 'fields', 'transform'],
  keywords: [
    'ndjson',
    'jsonl',
    'field filter',
    'pick fields',
    'drop fields',
    'rename fields',
  ],
  icon: 'ListFilter',
  relatedTools: [],
};

export default meta;
