import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-convert-jsonl-to-sql-insert-v1',
  name: 'JSON Lines to SQL INSERT',
  slug: 'convert-jsonl-to-sql-insert',
  description:
    "Generates SQL INSERT statements from NDJSON records using each object's keys as columns.",
  category: 'convert',
  tags: ['ndjson', 'jsonl', 'sql', 'insert', 'database'],
  keywords: ['jsonl to sql', 'ndjson to sql', 'json lines', 'bulk insert', 'seed', 'import'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
