import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-ndjson-v1',
  name: 'JSON to NDJSON / JSON Lines',
  slug: 'json-to-ndjson',
  description: 'Convert between a JSON array and newline-delimited JSON (NDJSON / JSON Lines).',
  category: 'data',
  tags: ['json', 'ndjson', 'convert'],
  keywords: ['ndjson', 'jsonl', 'json lines', 'array', 'convert'],
  icon: 'List',
  relatedTools: [],
};

export default meta;
