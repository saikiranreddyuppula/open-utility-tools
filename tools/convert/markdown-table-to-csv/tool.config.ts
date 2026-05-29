import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-markdown-table-to-csv-v1',
  name: 'Markdown Table to CSV',
  slug: 'markdown-table-to-csv',
  category: 'convert',
  description:
    'Extract a GitHub-style Markdown table and convert its rows into CSV, handling pipe escaping, alignment separators, and trimmed cells.',
  tags: ['markdown', 'table', 'csv', 'convert'],
  keywords: ['markdown', 'table', 'csv', 'convert', 'github', 'export'],
  icon: 'Table',
  relatedTools: ['csv-to-markdown'],
};

export default meta;
