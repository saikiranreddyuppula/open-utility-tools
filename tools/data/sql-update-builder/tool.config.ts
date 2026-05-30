import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-sql-update-builder-v1',
  name: 'SQL UPDATE Builder',
  slug: 'sql-update-builder',
  description: 'Build a safe parameterized UPDATE statement from column=value pairs and WHERE conditions.',
  category: 'data',
  tags: ['sql', 'update', 'query', 'builder', 'parameterized'],
  keywords: ['update set', 'sql builder', 'where', 'parameterized', 'placeholders', 'postgres', 'mysql'],
  icon: 'FilePlus',
  relatedTools: [],
};

export default meta;
