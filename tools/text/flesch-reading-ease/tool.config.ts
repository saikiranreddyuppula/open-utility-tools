import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-flesch-reading-ease-v1',
  name: 'Flesch Reading Ease Score',
  slug: 'flesch-reading-ease',
  description:
    'Compute the Flesch Reading Ease score and grade level for any text.',
  category: 'text',
  tags: ['readability', 'flesch', 'grade level', 'writing', 'analysis'],
  keywords: [
    'flesch reading ease',
    'flesch kincaid',
    'readability',
    'reading level',
    'grade level',
    'syllables',
    'writing score',
  ],
  icon: 'BookOpen',
  relatedTools: [],
};

export default meta;
