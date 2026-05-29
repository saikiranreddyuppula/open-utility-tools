import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-viewer-v1',
  name: 'CSV Viewer',
  slug: 'csv-viewer',
  description: 'Paste CSV and view it as a sortable, searchable table.',
  category: 'data',
  tags: ['csv', 'viewer', 'table', 'tsv', 'spreadsheet'],
  keywords: ['csv viewer', 'view csv', 'csv table', 'tsv', 'parse csv', 'spreadsheet'],
  icon: 'Table',
  relatedTools: ['csv-to-json', 'json-to-csv', 'json-formatter'],
};

export default meta;
