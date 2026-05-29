import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-nanoid-v1',
  name: 'Nano ID Generator',
  slug: 'nanoid-generator',
  description: 'Generate compact, URL-safe Nano IDs with a configurable length.',
  category: 'generators',
  tags: ['nanoid', 'id', 'url-safe', 'unique'],
  keywords: ['nanoid', 'nano id', 'short id', 'unique id', 'url safe'],
  icon: 'Hash',
  relatedTools: ['uuid-generator', 'ulid-generator', 'password-generator'],
};

export default meta;
