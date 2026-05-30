import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-sql-insert-from-json-v1',
  name: 'SQL INSERT from JSON',
  slug: 'sql-insert-from-json',
  description: 'Generate INSERT statements from a JSON array of objects with type-aware value quoting.',
  category: 'data',
  tags: ['sql', 'json', 'insert', 'dml', 'convert'],
  keywords: ['insert into', 'json to sql', 'bulk insert', 'multi-row', 'postgres', 'mysql', 'sqlite'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
