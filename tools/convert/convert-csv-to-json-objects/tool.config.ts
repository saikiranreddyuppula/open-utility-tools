import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-convert-csv-to-json-objects-v1',
  name: 'CSV to JSON Objects',
  slug: 'convert-csv-to-json-objects',
  description: 'Converts CSV with a header row into a JSON array of objects with typed values.',
  category: 'convert',
  tags: ['csv', 'json', 'convert', 'parse', 'objects'],
  keywords: ['csv to json', 'rfc 4180', 'header row', 'array of objects', 'type coercion', 'delimiter'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
