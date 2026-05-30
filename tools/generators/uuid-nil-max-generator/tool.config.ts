import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-uuid-nil-max-generator-v1',
  name: 'Nil & Max UUID Generator',
  slug: 'uuid-nil-max-generator',
  description: 'Produce the special all-zero Nil UUID and all-one Max UUID sentinel values.',
  category: 'generators',
  tags: ['uuid', 'nil', 'max', 'sentinel', 'rfc9562'],
  keywords: ['nil uuid', 'max uuid', 'all zero uuid', 'all ones uuid', 'empty guid', 'sentinel uuid'],
  icon: 'Diamond',
  relatedTools: [],
};

export default meta;
