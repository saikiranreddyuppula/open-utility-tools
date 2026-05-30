import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-prettier-config-generator-v1',
  name: 'Prettier Config Generator',
  slug: 'prettier-config-generator',
  description:
    'Build a .prettierrc from toggles (semicolons, quotes, tab width, trailing commas, print width) in JSON or JS.',
  category: 'generators',
  tags: ['prettier', 'config', 'formatter', 'json', 'tooling'],
  keywords: ['prettierrc', 'prettier config', 'code formatter', 'printWidth', 'semi', 'singleQuote'],
  icon: 'Paintbrush',
  relatedTools: [],
};

export default meta;
