import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-transliterate-greek-v1',
  name: 'Greek Transliteration',
  slug: 'transliterate-greek',
  description:
    'Convert Greek script to Latin (and back) using ISO 843, ELOT 743, or classical romanization schemes.',
  category: 'text',
  tags: ['greek', 'transliterate', 'romanize', 'iso843', 'latin'],
  keywords: ['greek to latin', 'romanization', 'iso 843', 'elot 743', 'classical greek', 'greek transliteration'],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
