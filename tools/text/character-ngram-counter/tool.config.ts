import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-character-ngram-counter-v1',
  name: 'Character N-Gram Counter',
  slug: 'character-ngram-counter',
  description:
    'Count character-level n-grams for linguistics, cryptanalysis, and fingerprinting.',
  category: 'text',
  tags: ['ngram', 'frequency', 'cryptanalysis', 'linguistics', 'analysis'],
  keywords: [
    'character ngram',
    'bigram',
    'trigram',
    'frequency analysis',
    'cipher',
    'fingerprint',
    'language detection',
  ],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
