import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-markdown-table-formatter-v1',
  name: 'Markdown Table Formatter',
  slug: 'markdown-table-formatter',
  description:
    'Reformat a messy Markdown table into clean column-aligned pipes with chosen alignment.',
  category: 'data',
  tags: ['markdown', 'table', 'formatter', 'align', 'gfm'],
  keywords: [
    'markdown table',
    'format table',
    'align columns',
    'gfm',
    'pretty table',
    'pipe table',
  ],
  icon: 'Table',
  relatedTools: [],
};

export default meta;
