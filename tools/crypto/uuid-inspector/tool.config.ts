import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-uuid-inspector-v1',
  name: 'UUID Inspector',
  slug: 'uuid-inspector',
  description:
    'Parse any UUID to reveal its version, variant, and embedded timestamp or node data.',
  category: 'crypto',
  tags: ['uuid', 'guid', 'inspect', 'parse', 'version'],
  keywords: ['uuidv1', 'uuidv4', 'uuidv6', 'uuidv7', 'variant', 'timestamp', 'node'],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
