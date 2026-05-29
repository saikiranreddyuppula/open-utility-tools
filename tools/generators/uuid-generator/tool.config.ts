import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-uuid-v1',
  name: 'UUID Generator',
  slug: 'uuid-generator',
  description: 'Generate RFC 4122 v4 (random) and v7 (time-ordered) UUIDs in bulk.',
  category: 'generators',
  tags: ['uuid', 'guid', 'v4', 'v7', 'id'],
  keywords: ['uuid', 'guid', 'unique id', 'v4', 'v7', 'random id'],
  icon: 'Fingerprint',
  relatedTools: ['hash-text', 'base64-text', 'jwt-decoder'],
};

export default meta;
