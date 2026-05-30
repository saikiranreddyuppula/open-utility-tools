import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-json-to-csv-flat-nested-v1',
  name: 'Nested JSON to Flat CSV',
  slug: 'data-json-to-csv-flat-nested',
  description: 'Flatten an array of nested JSON objects into CSV using dot-path column headers.',
  category: 'data',
  tags: ['json', 'csv', 'flatten', 'convert'],
  keywords: ['json', 'csv', 'flatten', 'nested', 'dot path', 'convert', 'export', 'spreadsheet'],
  icon: 'FileSpreadsheet',
  relatedTools: [],
};

export default meta;
