import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-xml-to-csv-v1',
  name: 'XML to CSV',
  slug: 'xml-to-csv',
  description: 'Flatten repeating XML elements into CSV rows.',
  category: 'convert',
  tags: ['xml', 'csv', 'convert', 'flatten', 'records'],
  keywords: ['xml to csv', 'records', 'rows', 'columns', 'rfc4180', 'spreadsheet'],
  icon: 'FileSpreadsheet',
  relatedTools: [],
};

export default meta;
