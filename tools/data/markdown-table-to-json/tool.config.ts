import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-markdown-table-to-json-v1',
  name: 'Markdown Table to JSON',
  slug: 'markdown-table-to-json',
  description: 'Convert a Markdown table into a JSON array of objects keyed by the header row.',
  category: 'data',
  tags: ['markdown', 'table', 'json', 'convert', 'gfm'],
  keywords: [
    'markdown table to json',
    'gfm',
    'table to json',
    'parse markdown table',
    'convert',
  ],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
