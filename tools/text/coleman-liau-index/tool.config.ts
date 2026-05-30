import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-coleman-liau-index-v1',
  name: 'Coleman-Liau Index',
  slug: 'coleman-liau-index',
  description:
    'Compute the character-based Coleman-Liau readability grade with no syllable counting.',
  category: 'text',
  tags: ['readability', 'grade level', 'metrics', 'writing', 'analysis'],
  keywords: [
    'coleman liau',
    'readability',
    'grade level',
    'reading level',
    'letters per word',
    'writing score',
  ],
  icon: 'FileText',
  relatedTools: [],
};

export default meta;
