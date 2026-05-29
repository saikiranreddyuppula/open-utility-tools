import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-ulid-v1',
  name: 'ULID Generator',
  slug: 'ulid-generator',
  description: 'Generate lexicographically-sortable ULIDs in bulk, locally.',
  category: 'generators',
  tags: ['ulid', 'id', 'sortable', 'unique'],
  keywords: ['ulid', 'sortable id', 'unique id', 'identifier'],
  icon: 'Fingerprint',
  relatedTools: ['uuid-generator', 'nanoid-generator', 'password-generator'],
};

export default meta;
