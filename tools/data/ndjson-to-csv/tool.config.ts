import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-ndjson-to-csv-v1',
  name: 'NDJSON to CSV',
  slug: 'ndjson-to-csv',
  description: 'Convert newline-delimited JSON objects into a CSV table with a unified header.',
  category: 'data',
  tags: ['ndjson', 'csv', 'json-lines', 'convert', 'flatten'],
  keywords: ['jsonl', 'jsonlines', 'ndjson to csv', 'json lines to csv', 'tabular', 'spreadsheet'],
  icon: 'FileSpreadsheet',
  relatedTools: [],
};

export default meta;
