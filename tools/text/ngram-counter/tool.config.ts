import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-ngram-counter-v1',
  name: 'N-Gram Frequency Counter',
  slug: 'ngram-counter',
  description:
    'Extract and count the most frequent word n-grams (bigrams, trigrams, etc.) in text.',
  category: 'text',
  tags: ['ngram', 'bigram', 'trigram', 'frequency', 'phrases'],
  keywords: [
    'ngram',
    'bigram',
    'trigram',
    'word frequency',
    'phrase frequency',
    'collocation',
    'stop words',
  ],
  icon: 'Combine',
  relatedTools: [],
};

export default meta;
