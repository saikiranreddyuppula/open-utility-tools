import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-base62-encode-v1',
  name: 'Base62 Encode / Decode',
  slug: 'encoding-base62-encode',
  description:
    'Encode bytes or big integers to Base62 (0-9A-Za-z) and decode back, like short-URL IDs use.',
  category: 'encoding',
  tags: ['base62', 'shorturl', 'bigint', 'encode', 'decode'],
  keywords: [
    'base62',
    'base 62',
    'short url',
    'id',
    'alphanumeric',
    'bigint',
    'encode',
  ],
  icon: 'Link',
  relatedTools: [],
};

export default meta;
