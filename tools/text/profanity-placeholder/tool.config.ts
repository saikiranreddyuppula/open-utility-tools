import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-profanity-placeholder-v1',
  name: 'Profanity Censor (Offline)',
  slug: 'profanity-placeholder',
  description: 'Mask flagged words in text with symbols using a user-editable word list.',
  category: 'text',
  tags: ['profanity', 'censor', 'filter', 'mask', 'redact'],
  keywords: [
    'profanity filter',
    'censor words',
    'bad words',
    'mask text',
    'redact',
    'bleep',
    'word list',
  ],
  icon: 'Shield',
  relatedTools: [],
};

export default meta;
