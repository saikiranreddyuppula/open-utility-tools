import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-ndjson-to-json-array-v1',
  name: 'NDJSON to JSON Array',
  slug: 'ndjson-to-json-array',
  description: 'Convert NDJSON / JSON Lines to a single JSON array and back.',
  category: 'data',
  tags: ['ndjson', 'json', 'json-lines', 'array', 'convert'],
  keywords: ['jsonl', 'jsonlines', 'ndjson to array', 'array to ndjson', 'round trip', 'json lines'],
  icon: 'Rows3',
  relatedTools: [],
};

export default meta;
