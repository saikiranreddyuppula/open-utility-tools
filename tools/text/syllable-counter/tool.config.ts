import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-syllable-counter-v1',
  name: 'Syllable Counter',
  slug: 'syllable-counter',
  description: 'Count syllables in words and whole text using an English heuristic algorithm.',
  category: 'text',
  tags: ['syllable', 'text', 'poetry', 'haiku', 'count'],
  keywords: ['syllable', 'count', 'haiku', 'poetry', 'meter', 'vowel groups', 'phonetics'],
  icon: 'Speech',
  relatedTools: [],
};

export default meta;
