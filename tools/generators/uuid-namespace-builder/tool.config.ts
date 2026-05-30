import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-uuid-namespace-builder-v1',
  name: 'UUID Namespace Builder',
  slug: 'uuid-namespace-builder',
  description: 'Build and manage RFC 4122 namespace UUIDs and derive v5/v3 names beneath a custom namespace, offline.',
  category: 'generators',
  tags: ['uuid', 'namespace', 'v5', 'v3', 'deterministic'],
  keywords: ['namespace uuid', 'uuid v5', 'uuid v3', 'sha-1 uuid', 'md5 uuid', 'derive uuid', 'rfc 4122'],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
