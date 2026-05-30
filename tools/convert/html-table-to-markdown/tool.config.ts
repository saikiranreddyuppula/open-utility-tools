import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-html-table-to-markdown-v1',
  name: 'HTML Table to Markdown',
  slug: 'html-table-to-markdown',
  description:
    'Extract <table> elements from HTML and render them as GitHub-flavored Markdown pipe tables.',
  category: 'convert',
  tags: ['html', 'table', 'markdown', 'convert', 'gfm'],
  keywords: ['pipe table', 'thead', 'alignment', 'tbody', 'github'],
  icon: 'Table',
  relatedTools: [],
};

export default meta;
