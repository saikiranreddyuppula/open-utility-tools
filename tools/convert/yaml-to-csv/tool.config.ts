import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-yaml-to-csv-v1',
  name: 'YAML to CSV',
  slug: 'yaml-to-csv',
  description: 'Flatten a YAML list of objects into CSV.',
  category: 'convert',
  tags: ['yaml', 'csv', 'convert', 'flatten', 'data'],
  keywords: ['yaml to csv', 'spreadsheet', 'tabular', 'records', 'rfc4180'],
  icon: 'Table',
  relatedTools: [],
};

export default meta;
