import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-convert-csv-to-sql-insert-batch-v1',
  name: 'CSV to Batched SQL INSERT',
  slug: 'convert-csv-to-sql-insert-batch',
  description:
    'Generate multi-row batched SQL INSERT statements from CSV with a configurable batch size.',
  category: 'convert',
  tags: ['csv', 'sql', 'insert', 'database', 'batch', 'migration'],
  keywords: ['csv to sql', 'bulk insert', 'seed data', 'mysql', 'postgres', 'sqlite', 'ndjson'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
