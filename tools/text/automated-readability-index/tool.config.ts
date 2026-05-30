import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-automated-readability-index-v1',
  name: 'Automated Readability Index (ARI)',
  slug: 'automated-readability-index',
  description: 'Compute the ARI grade level from character, word, and sentence counts.',
  category: 'text',
  tags: ['readability', 'ari', 'grade-level', 'analysis', 'prose'],
  keywords: [
    'automated readability index',
    'ari score',
    'reading grade level',
    'text difficulty',
    'reading age',
    'readability test',
  ],
  icon: 'Gauge',
  relatedTools: [],
};

export default meta;
