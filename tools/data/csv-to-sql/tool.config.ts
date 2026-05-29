import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-to-sql-v1',
  name: 'CSV to SQL INSERT',
  slug: 'csv-to-sql',
  description: 'Generate SQL INSERT statements from CSV with a configurable table name and quoting.',
  category: 'data',
  tags: ['csv', 'sql'],
  keywords: ['csv', 'sql', 'insert', 'database', 'generate'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
