import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-sql-create-table-from-csv-v1',
  name: 'SQL CREATE TABLE from CSV',
  slug: 'sql-create-table-from-csv',
  description: 'Generate a CREATE TABLE statement (with inferred column types) from a CSV header and sample rows.',
  category: 'data',
  tags: ['sql', 'csv', 'ddl', 'schema', 'create-table'],
  keywords: ['create table', 'csv to sql', 'infer types', 'ddl', 'postgres', 'mysql', 'sqlite'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
