import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-deduplicate-words-v1',
  name: 'Deduplicate Words',
  slug: 'deduplicate-words',
  description:
    'Remove repeated words from text while preserving order, optionally case-insensitively or only consecutive duplicates.',
  category: 'text',
  tags: ['words', 'dedupe', 'duplicate', 'unique', 'cleanup'],
  keywords: [
    'remove duplicate words',
    'repeated words',
    'unique words',
    'double word typo',
    'the the fix',
    'word dedup',
  ],
  icon: 'Filter',
  relatedTools: [],
};

export default meta;
