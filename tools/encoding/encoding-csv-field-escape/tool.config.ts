import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-csv-field-escape-v1',
  name: 'CSV Field Escaper / Unescaper',
  slug: 'encoding-csv-field-escape',
  description:
    'Escape a single value for safe CSV embedding (RFC 4180 quoting) and unescape a CSV field.',
  category: 'encoding',
  tags: ['csv', 'escape', 'rfc-4180', 'quoting', 'spreadsheet'],
  keywords: ['csv escape', 'rfc 4180', 'quote field', 'csv field', 'spreadsheet', 'delimiter'],
  icon: 'FileSpreadsheet',
  relatedTools: [],
};

export default meta;
