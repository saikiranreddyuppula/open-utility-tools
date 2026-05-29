import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-remove-accents-v1',
  name: 'Remove Accents',
  slug: 'remove-accents',
  description:
    'Strip diacritics and accents from text, converting characters like e-acute, n-tilde, and u-umlaut to plain ASCII equivalents.',
  category: 'text',
  tags: ['accents', 'diacritics', 'ascii', 'normalize'],
  keywords: ['accents', 'diacritics', 'ascii', 'normalize', 'transliterate'],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
