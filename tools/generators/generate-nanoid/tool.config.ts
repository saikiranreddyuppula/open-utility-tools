import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-nanoid-v1',
  name: 'NanoID Generator',
  slug: 'generate-nanoid',
  description:
    'Generate compact, URL-safe NanoIDs with configurable length and alphabet, a popular smaller alternative to UUIDs for keys and short links.',
  category: 'generators',
  tags: ['nanoid', 'id', 'short', 'url-safe', 'unique', 'key'],
  keywords: ['nanoid', 'id', 'short', 'url-safe', 'unique', 'key'],
  icon: 'KeyRound',
  relatedTools: [],
};

export default meta;
