import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-truncator-v1',
  name: 'Text Truncator',
  slug: 'text-truncator',
  description:
    'Truncate text or each line to a maximum length by characters or words, appending an ellipsis or custom suffix.',
  category: 'text',
  tags: ['truncate', 'shorten', 'limit'],
  keywords: ['truncate', 'shorten', 'ellipsis', 'limit', 'trim'],
  icon: 'Scissors',
  relatedTools: [],
};

export default meta;
