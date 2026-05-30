import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-sql-select-builder-v1',
  name: 'SQL SELECT Builder',
  slug: 'sql-select-builder',
  description: 'Visually build a SELECT query with columns, WHERE conditions, ORDER BY, and LIMIT, then copy the SQL.',
  category: 'data',
  tags: ['sql', 'select', 'query', 'builder', 'where'],
  keywords: ['select query', 'sql builder', 'where', 'order by', 'limit', 'postgres', 'mysql'],
  icon: 'FileSearch',
  relatedTools: [],
};

export default meta;
