import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-uuid-v7-generator-v1',
  name: 'UUID v7 Generator',
  slug: 'uuid-v7-generator',
  description: 'Generate time-ordered, sortable UUID v7 identifiers using the current timestamp.',
  category: 'generators',
  tags: ['uuid', 'v7', 'sortable', 'timestamp', 'rfc9562'],
  keywords: ['uuid v7', 'time ordered uuid', 'sortable uuid', 'unix timestamp uuid', 'monotonic uuid'],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
