import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-keyword-density-analyzer-v1',
  name: 'Keyword Density Analyzer',
  slug: 'keyword-density-analyzer',
  description:
    'Measure single-word and phrase keyword density with stop-word filtering for SEO.',
  category: 'text',
  tags: ['seo', 'keyword density', 'frequency', 'stop words', 'content'],
  keywords: [
    'keyword density',
    'seo',
    'stop words',
    'word frequency',
    'content optimization',
    'phrase',
  ],
  icon: 'Target',
  relatedTools: [],
};

export default meta;
