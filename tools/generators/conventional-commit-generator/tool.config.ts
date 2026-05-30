import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-conventional-commit-generator-v1',
  name: 'Conventional Commit Message Builder',
  slug: 'conventional-commit-generator',
  description: 'Build a Conventional Commits message from type, scope, description, body, breaking change, and footers.',
  category: 'generators',
  tags: ['conventional-commits', 'git', 'commit', 'semver', 'changelog'],
  keywords: ['conventional commits', 'commit message', 'git commit', 'breaking change', 'gitmoji', 'commitlint'],
  icon: 'GitCompare',
  relatedTools: [],
};

export default meta;
