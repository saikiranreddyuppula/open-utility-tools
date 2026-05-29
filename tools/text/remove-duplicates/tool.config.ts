import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-remove-duplicates-v1',
  name: 'Remove Duplicate Lines',
  slug: 'remove-duplicates',
  description: 'Strip duplicate lines, keeping first occurrence, with optional case-insensitivity.',
  category: 'text',
  tags: ['duplicate', 'dedupe', 'unique', 'lines'],
  keywords: ['remove duplicates', 'dedupe', 'unique lines', 'distinct'],
  icon: 'Filter',
  relatedTools: ['sort-lines', 'word-count', 'whitespace-cleaner'],
};

export default meta;
