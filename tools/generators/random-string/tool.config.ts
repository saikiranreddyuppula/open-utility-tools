import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-uuid-namespace-v1',
  name: 'Random String Generator',
  slug: 'random-string',
  description: 'Generate random strings from a chosen alphabet (hex, alphanumeric, custom).',
  category: 'generators',
  tags: ['random', 'string', 'token', 'hex', 'alphanumeric'],
  keywords: ['random string', 'token', 'random hex', 'api key', 'secret'],
  icon: 'Dice5',
  relatedTools: ['password-generator', 'uuid-generator', 'nanoid-generator'],
};

export default meta;
