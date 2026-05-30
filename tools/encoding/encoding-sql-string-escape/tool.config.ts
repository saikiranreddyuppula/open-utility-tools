import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-sql-string-escape-v1',
  name: 'SQL String Escaper',
  slug: 'encoding-sql-string-escape',
  description: 'Escape text into a safe SQL string literal for common database dialects.',
  category: 'encoding',
  tags: ['sql', 'escape', 'literal', 'database', 'developer'],
  keywords: ['sql', 'escape', 'string', 'literal', 'quote', 'mysql', 'postgres', 'sqlite', 'sql server', 'injection'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
