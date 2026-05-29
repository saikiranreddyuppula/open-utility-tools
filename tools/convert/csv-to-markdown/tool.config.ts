import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-csv-to-markdown-v1',
  name: 'CSV to Markdown Table',
  slug: 'csv-to-markdown',
  description: 'Convert CSV into a GitHub-flavored Markdown table.',
  category: 'convert',
  tags: ['csv', 'markdown', 'table', 'convert', 'gfm'],
  keywords: ['csv to markdown', 'markdown table', 'gfm table', 'convert csv'],
  icon: 'Table',
  relatedTools: ['csv-to-json', 'json-to-csv', 'markdown-to-html'],
};

export default meta;
