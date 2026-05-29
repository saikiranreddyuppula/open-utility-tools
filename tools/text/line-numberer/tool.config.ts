import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-line-operations-v1',
  name: 'Line Operations',
  slug: 'line-operations',
  description: 'Number, prefix, suffix, or wrap each line of text.',
  category: 'text',
  tags: ['lines', 'number', 'prefix', 'suffix', 'wrap'],
  keywords: ['number lines', 'add prefix', 'add suffix', 'wrap lines', 'line operations'],
  icon: 'ListOrdered',
  relatedTools: ['sort-lines', 'remove-duplicates', 'whitespace-cleaner'],
};

export default meta;
