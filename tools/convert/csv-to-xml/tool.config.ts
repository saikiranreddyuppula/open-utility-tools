import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-csv-to-xml-v1',
  name: 'CSV to XML',
  slug: 'csv-to-xml',
  description: 'Convert CSV rows into an XML document.',
  category: 'convert',
  tags: ['csv', 'xml', 'convert', 'data', 'export'],
  keywords: ['csv to xml', 'tabular to xml', 'rows to xml', 'spreadsheet', 'rfc 4180'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
