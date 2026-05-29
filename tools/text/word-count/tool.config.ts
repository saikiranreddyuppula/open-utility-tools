import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-word-count-v1',
  name: 'Word & Character Count',
  slug: 'word-count',
  description: 'Live counts of words, characters, sentences, lines, and reading time.',
  category: 'text',
  tags: ['word count', 'character count', 'statistics', 'readability'],
  keywords: ['word count', 'char count', 'characters', 'lines', 'reading time', 'statistics'],
  icon: 'BarChart3',
  relatedTools: ['whitespace-cleaner', 'sort-lines', 'case-converter'],
};

export default meta;
