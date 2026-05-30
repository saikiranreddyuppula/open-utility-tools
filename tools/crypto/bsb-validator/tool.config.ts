import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-bsb-validator-v1',
  name: 'Australian BSB Lookup',
  slug: 'bsb-validator',
  description: 'Validate and parse an Australian Bank State Branch (BSB) number into bank, state, and branch.',
  category: 'crypto',
  tags: ['bsb', 'bank', 'australia', 'lookup', 'parse'],
  keywords: ['bsb', 'bank state branch', 'australian bank', 'routing', 'sort code', 'branch'],
  icon: 'University',
  relatedTools: [],
};

export default meta;
