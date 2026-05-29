import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-count-occurrences-v1',
  name: 'Count Occurrences',
  slug: 'count-occurrences',
  description: 'Count how many times a substring or regex pattern appears in text.',
  category: 'text',
  tags: ['count', 'occurrences', 'find', 'frequency', 'search'],
  keywords: ['count occurrences', 'count matches', 'word count', 'substring count', 'how many'],
  icon: 'Hash',
  relatedTools: ['find-replace', 'regex-tester', 'text-statistics'],
};

export default meta;
