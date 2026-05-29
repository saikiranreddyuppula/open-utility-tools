import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-statistics-v1',
  name: 'Text Statistics & Frequency',
  slug: 'text-statistics',
  description: 'Analyze word frequency, character distribution and readability of text.',
  category: 'text',
  tags: ['statistics', 'frequency', 'word count', 'analysis', 'readability'],
  keywords: ['word frequency', 'text analysis', 'character count', 'readability', 'most common words'],
  icon: 'BarChart3',
  relatedTools: ['word-count', 'sort-lines', 'remove-duplicates'],
};

export default meta;
