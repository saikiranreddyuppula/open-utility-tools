import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-pattern-password-generator-v1',
  name: 'Pattern-Based Password Generator',
  slug: 'pattern-password-generator',
  description:
    'Generate strings from a placeholder pattern where each token maps to a character class.',
  category: 'generators',
  tags: ['password', 'pattern', 'template', 'random', 'license-key'],
  keywords: ['pattern password', 'license key', 'ticket code', 'mask', 'token', 'placeholder'],
  icon: 'Regex',
  relatedTools: [],
};

export default meta;
