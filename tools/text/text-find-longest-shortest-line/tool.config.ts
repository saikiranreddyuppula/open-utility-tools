import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-find-longest-shortest-line-v1',
  name: 'Longest and Shortest Line Finder',
  slug: 'text-find-longest-shortest-line',
  description:
    'Finds the longest and shortest lines in a block of text with their lengths and line numbers.',
  category: 'text',
  tags: ['lines', 'length', 'measure', 'analyze', 'statistics'],
  keywords: [
    'longest line',
    'shortest line',
    'line length',
    'line number',
    'average line length',
    'median line length',
    'measure lines',
  ],
  icon: 'Ruler',
  relatedTools: [],
};

export default meta;
