import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-csv-v1',
  name: 'JSON to CSV',
  slug: 'json-to-csv',
  description: 'Convert a JSON array of objects into CSV, with a chosen delimiter.',
  category: 'data',
  tags: ['json', 'csv', 'convert', 'export', 'table'],
  keywords: ['json to csv', 'export csv', 'flatten', 'array of objects', 'tabular'],
  icon: 'FileSpreadsheet',
  relatedTools: ['csv-to-json', 'json-formatter', 'csv-viewer'],
};

export default meta;
