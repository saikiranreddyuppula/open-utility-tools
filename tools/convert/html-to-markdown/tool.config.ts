import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-html-to-markdown-v1',
  name: 'HTML to Markdown',
  slug: 'html-to-markdown',
  category: 'convert',
  description:
    'Convert HTML into clean Markdown, mapping headings, links, images, lists, blockquotes, code, and emphasis back to plain Markdown syntax.',
  tags: ['html', 'markdown', 'convert'],
  keywords: ['html', 'markdown', 'md', 'convert', 'reverse', 'transform'],
  icon: 'FileText',
  relatedTools: ['markdown-to-html'],
};

export default meta;
