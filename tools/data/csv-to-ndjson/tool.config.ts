import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-to-ndjson-v1',
  name: 'CSV to NDJSON',
  slug: 'csv-to-ndjson',
  description:
    'Convert CSV with a header row into newline-delimited JSON (one JSON object per line).',
  category: 'data',
  tags: ['csv', 'ndjson', 'jsonlines', 'convert', 'jsonl'],
  keywords: ['csv to ndjson', 'json lines', 'jsonl', 'newline delimited json', 'csv convert', 'streaming json'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
