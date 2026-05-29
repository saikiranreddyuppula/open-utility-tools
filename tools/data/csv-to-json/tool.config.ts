import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-to-json-v1',
  name: 'CSV to JSON',
  slug: 'csv-to-json',
  description: 'Convert CSV (with header row) into a JSON array of objects.',
  category: 'data',
  tags: ['csv', 'json', 'convert', 'parse', 'import'],
  keywords: ['csv to json', 'parse csv', 'import', 'array of objects'],
  icon: 'Braces',
  relatedTools: ['json-to-csv', 'json-formatter', 'csv-viewer'],
};

export default meta;
