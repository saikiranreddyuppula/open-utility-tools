import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-json-to-csv-explode-array-v1',
  name: 'JSON Array of Objects to CSV (Explode)',
  slug: 'data-json-to-csv-explode-array',
  description: 'Converts a JSON array of objects to CSV, exploding nested objects into dotted columns.',
  category: 'data',
  tags: ['json', 'csv', 'flatten', 'convert'],
  keywords: ['json', 'csv', 'convert', 'flatten', 'explode', 'nested', 'dot path', 'export'],
  icon: 'FileSpreadsheet',
  relatedTools: [],
};

export default meta;
