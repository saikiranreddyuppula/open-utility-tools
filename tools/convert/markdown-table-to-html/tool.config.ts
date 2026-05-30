import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-markdown-table-to-html-v1',
  name: 'Markdown Table to HTML',
  slug: 'markdown-table-to-html',
  description:
    'Convert a GitHub-flavored Markdown pipe table into a clean semantic HTML table with alignment.',
  category: 'convert',
  tags: ['markdown', 'html', 'table', 'convert'],
  keywords: ['markdown', 'table', 'html', 'gfm', 'pipe', 'thead', 'alignment', 'convert'],
  icon: 'TableProperties',
  relatedTools: [],
};

export default meta;
