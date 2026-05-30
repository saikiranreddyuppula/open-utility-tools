import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-eslint-config-generator-v1',
  name: 'ESLint Flat Config Generator',
  slug: 'eslint-config-generator',
  description:
    'Scaffold an eslint.config.js flat config (or .eslintrc) from language, env, and rule-preset choices.',
  category: 'generators',
  tags: ['eslint', 'config', 'linting', 'javascript', 'typescript'],
  keywords: [
    'eslint',
    'flat config',
    'eslint.config.js',
    '.eslintrc',
    'linting',
    'rules',
    'no-unused-vars',
    'prefer-const',
    'scaffold',
  ],
  icon: 'Sparkles',
  relatedTools: [],
};

export default meta;
