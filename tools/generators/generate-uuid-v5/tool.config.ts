import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-uuid-v5-v1',
  name: 'UUID v5 / v3 Generator',
  slug: 'generate-uuid-v5',
  description:
    'Generate deterministic namespace UUIDs (v5 SHA-1 and v3 MD5) from a namespace UUID plus a name, so the same input always yields the same UUID.',
  category: 'generators',
  tags: ['uuid', 'v5', 'v3'],
  keywords: ['uuid', 'v5', 'v3', 'namespace', 'deterministic', 'sha1'],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
