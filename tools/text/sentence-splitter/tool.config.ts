import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-sentence-splitter-v1',
  name: 'Sentence Splitter',
  slug: 'sentence-splitter',
  description:
    'Split a paragraph into one sentence per line using punctuation and abbreviation rules.',
  category: 'text',
  tags: ['text', 'sentences', 'split', 'nlp'],
  keywords: [
    'sentence',
    'split',
    'segment',
    'tokenize',
    'one per line',
    'paragraph',
    'punctuation',
  ],
  icon: 'SplitSquareHorizontal',
  relatedTools: [],
};

export default meta;
