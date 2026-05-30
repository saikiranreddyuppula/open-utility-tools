import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-word-length-distribution-v1',
  name: 'Word & Sentence Length Distribution',
  slug: 'word-length-distribution',
  description: 'Show how word lengths and sentence lengths are distributed across text.',
  category: 'text',
  tags: ['distribution', 'statistics', 'histogram', 'analysis', 'length'],
  keywords: [
    'word length',
    'sentence length',
    'histogram',
    'distribution',
    'mean median mode',
    'standard deviation',
    'dispersion',
  ],
  icon: 'BarChart3',
  relatedTools: [],
};

export default meta;
