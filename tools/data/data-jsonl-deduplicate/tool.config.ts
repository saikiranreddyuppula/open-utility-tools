import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-jsonl-deduplicate-v1',
  name: 'JSONL Record Deduplicator',
  slug: 'data-jsonl-deduplicate',
  description: 'Remove duplicate JSON objects from JSON Lines input, optionally keyed by selected fields.',
  category: 'data',
  tags: ['jsonl', 'dedupe', 'ndjson', 'unique'],
  keywords: ['jsonl', 'ndjson', 'dedupe', 'duplicate', 'unique', 'json lines', 'records', 'distinct'],
  icon: 'Filter',
  relatedTools: [],
};

export default meta;
