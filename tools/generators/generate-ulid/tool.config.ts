import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-ulid-v1',
  name: 'ULID Generator',
  slug: 'generate-ulid',
  description:
    'Generate ULIDs (Universally Unique Lexicographically Sortable Identifiers): 26-char Crockford base32 IDs with a millisecond timestamp prefix and random suffix, sortable by creation time.',
  category: 'generators',
  tags: ['ulid', 'id', 'sortable', 'identifier', 'unique', 'timestamp'],
  keywords: ['ulid', 'id', 'sortable', 'identifier', 'unique', 'timestamp'],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
