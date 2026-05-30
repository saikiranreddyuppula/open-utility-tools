import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-csv-to-yaml-v1',
  name: 'CSV to YAML',
  slug: 'csv-to-yaml',
  description: 'Convert CSV rows into a YAML list of objects.',
  category: 'convert',
  tags: ['csv', 'yaml', 'convert', 'data', 'transform'],
  keywords: ['csv2yaml', 'spreadsheet', 'rfc4180', 'records', 'mapping'],
  icon: 'FileSpreadsheet',
  relatedTools: [],
};

export default meta;
