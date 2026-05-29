import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-sql-formatter-v1',
  name: 'SQL Formatter',
  slug: 'sql-formatter',
  description: 'Format and indent SQL queries with keyword casing.',
  category: 'data',
  tags: ['sql', 'format', 'beautify', 'query', 'prettify'],
  keywords: ['sql formatter', 'format sql', 'beautify sql', 'pretty sql', 'indent query'],
  icon: 'Database',
  relatedTools: ['json-formatter', 'css-minify', 'json-to-csv'],
};

export default meta;
