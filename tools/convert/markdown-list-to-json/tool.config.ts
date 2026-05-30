import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-markdown-list-to-json-v1',
  name: 'Markdown List ↔ JSON Tree',
  slug: 'markdown-list-to-json',
  description:
    'Convert an indented Markdown bullet/numbered list into a nested JSON array (and back).',
  category: 'convert',
  tags: ['markdown', 'json', 'tree', 'list', 'convert'],
  keywords: ['markdown', 'list', 'json', 'tree', 'nested', 'outline', 'bullet', 'convert'],
  icon: 'ListTree',
  relatedTools: [],
};

export default meta;
