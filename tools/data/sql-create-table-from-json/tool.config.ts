import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-sql-create-table-from-json-v1',
  name: 'SQL CREATE TABLE from JSON',
  slug: 'sql-create-table-from-json',
  description: 'Generate a CREATE TABLE statement by inferring columns and types from a JSON array of objects.',
  category: 'data',
  tags: ['sql', 'json', 'ddl', 'schema', 'create-table'],
  keywords: ['create table', 'json to sql', 'infer schema', 'ddl', 'postgres', 'mysql', 'sqlite'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
