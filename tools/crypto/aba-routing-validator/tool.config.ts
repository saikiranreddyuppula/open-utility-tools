import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-aba-routing-validator-v1',
  name: 'ABA Routing Number Validator',
  slug: 'aba-routing-validator',
  description: 'Validate a US bank ABA/routing transit number using its mod-10 checksum.',
  category: 'crypto',
  tags: ['aba', 'routing', 'bank', 'checksum', 'mod-10'],
  keywords: ['aba routing number', 'routing transit number', 'rtn', 'bank routing', 'checksum', 'federal reserve'],
  icon: 'Banknote',
  relatedTools: [],
};

export default meta;
