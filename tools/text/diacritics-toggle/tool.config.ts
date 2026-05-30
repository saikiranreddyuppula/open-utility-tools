import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-diacritics-toggle-v1',
  name: 'Add / Strip Diacritics',
  slug: 'diacritics-toggle',
  description:
    'Strip accents to plain ASCII, or fold text to ASCII-safe forms, with a map for common transliterations.',
  category: 'text',
  tags: ['diacritics', 'accents', 'ascii', 'fold', 'transliterate'],
  keywords: [
    'strip diacritics',
    'ascii fold',
    'remove accents',
    'ligatures',
    'slug safe',
    'transliterate',
    'normalize nfd',
  ],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
