import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-random-string-v1',
  name: 'Random String Generator',
  slug: 'generate-random-string',
  description:
    'Generate random strings/tokens with toggleable character sets (lowercase, uppercase, digits, symbols), custom length, and quantity for API keys, secrets, and test data.',
  category: 'generators',
  tags: ['random', 'string', 'token'],
  keywords: ['random', 'string', 'token', 'secret', 'key', 'alphanumeric'],
  icon: 'Shuffle',
  relatedTools: [],
};

export default meta;
