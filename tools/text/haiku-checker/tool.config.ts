import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-haiku-checker-v1',
  name: 'Haiku Syllable Checker',
  slug: 'haiku-checker',
  description:
    'Verify whether three lines follow the 5-7-5 haiku syllable pattern.',
  category: 'text',
  tags: ['haiku', 'syllables', 'poetry', 'meter', 'checker'],
  keywords: [
    'haiku',
    'syllable counter',
    '5-7-5',
    'poetry',
    'lune',
    'meter',
    'verse',
  ],
  icon: 'Feather',
  relatedTools: [],
};

export default meta;
