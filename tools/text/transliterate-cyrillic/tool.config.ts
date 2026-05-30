import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-transliterate-cyrillic-v1',
  name: 'Cyrillic Transliteration',
  slug: 'transliterate-cyrillic',
  description:
    'Transliterate between Cyrillic and Latin using selectable schemes (GOST, BGN/PCGN, scientific, ISO 9).',
  category: 'text',
  tags: ['cyrillic', 'transliterate', 'romanize', 'russian', 'latin'],
  keywords: ['cyrillic to latin', 'romanization', 'iso 9', 'gost', 'bgn pcgn', 'russian transliteration'],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
