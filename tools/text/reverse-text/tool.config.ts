import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-reverse-v1',
  name: 'Reverse Text',
  slug: 'reverse-text',
  description: 'Reverse characters, words, or line order in text.',
  category: 'text',
  tags: ['reverse', 'flip', 'backwards', 'mirror'],
  keywords: ['reverse text', 'backwards', 'flip', 'mirror', 'reverse words', 'reverse lines'],
  icon: 'FlipHorizontal',
  relatedTools: ['sort-lines', 'case-converter', 'rot13'],
};

export default meta;
