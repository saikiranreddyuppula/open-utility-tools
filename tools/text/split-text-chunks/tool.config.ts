import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-split-text-chunks-v1',
  name: 'Split Text Into Chunks',
  slug: 'split-text-chunks',
  description:
    'Break text into fixed-size pieces by character count, word count, or line count, with optional numbered labels.',
  category: 'text',
  tags: ['text', 'split', 'chunk', 'sms'],
  keywords: [
    'split',
    'chunk',
    'segment',
    'sms',
    'tweet',
    'character limit',
    'word count',
    'paginate',
  ],
  icon: 'Scissors',
  relatedTools: [],
};

export default meta;
