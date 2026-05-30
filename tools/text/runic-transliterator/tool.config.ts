import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-runic-transliterator-v1',
  name: 'Runic Transliterator',
  slug: 'runic-transliterator',
  description:
    'Convert Latin text to Elder Futhark or Younger Futhark runes (and back) using a fixed letter mapping.',
  category: 'text',
  tags: ['runes', 'futhark', 'transliterate', 'norse', 'viking'],
  keywords: [
    'runic',
    'elder futhark',
    'younger futhark',
    'runes',
    'norse',
    'viking alphabet',
    'transliterate',
  ],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
