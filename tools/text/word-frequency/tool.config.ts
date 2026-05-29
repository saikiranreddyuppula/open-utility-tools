import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-word-frequency-v1',
  name: 'Word Frequency Counter',
  slug: 'word-frequency',
  description:
    'Count how often each word appears and rank them by frequency, with options to ignore case and skip common stop words.',
  category: 'text',
  tags: ['frequency', 'keyword density', 'ranking', 'tally'],
  keywords: ['frequency', 'keyword density', 'tally', 'occurrences', 'ranking'],
  icon: 'BarChart3',
  relatedTools: [],
};

export default meta;
