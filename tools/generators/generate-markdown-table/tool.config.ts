import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-markdown-table-v1',
  name: 'Markdown Table Generator',
  slug: 'generate-markdown-table',
  description:
    'Generate clean GitHub-flavored Markdown tables from pasted CSV/TSV or row/column counts, with column alignment and auto-padded columns.',
  category: 'generators',
  tags: ['markdown', 'generator', 'convert'],
  keywords: ['markdown', 'table', 'csv', 'github', 'alignment', 'convert'],
  icon: 'Table',
  relatedTools: [],
};

export default meta;
