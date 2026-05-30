import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-outline-to-list-v1',
  name: 'Indented Outline ↔ Nested List',
  slug: 'outline-to-list',
  description:
    'Convert tab/space-indented outlines to Markdown/HTML nested lists, or flatten nested lists to an outline.',
  category: 'text',
  tags: ['outline', 'list', 'nested', 'markdown', 'html'],
  keywords: [
    'outline',
    'nested list',
    'markdown list',
    'html ul ol',
    'indent',
    'tree',
    'flatten',
    'breadcrumb path',
  ],
  icon: 'ListTree',
  relatedTools: [],
};

export default meta;
