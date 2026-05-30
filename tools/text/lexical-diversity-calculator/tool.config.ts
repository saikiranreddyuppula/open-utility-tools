import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-lexical-diversity-calculator-v1',
  name: 'Lexical Diversity Calculator',
  slug: 'lexical-diversity-calculator',
  description:
    'Measure vocabulary richness with type-token ratio and related metrics.',
  category: 'text',
  tags: ['lexical diversity', 'ttr', 'vocabulary', 'linguistics', 'metrics'],
  keywords: [
    'type token ratio',
    'lexical diversity',
    'vocabulary richness',
    'guiraud',
    'herdan',
    'hapax legomena',
    'ttr',
  ],
  icon: 'ChartBar',
  relatedTools: [],
};

export default meta;
