import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-semver-range-tester-v1',
  name: 'Semver Range Tester',
  slug: 'web-semver-range-tester',
  description: 'Test whether semantic versions satisfy npm-style version ranges (caret, tilde, comparators, hyphen ranges).',
  category: 'web',
  tags: ['semver', 'range', 'npm', 'caret', 'tilde'],
  keywords: ['version satisfies', 'range satisfaction', 'comparator', 'wildcard', 'hyphen range', 'x-range', '^', '~'],
  icon: 'GitCompare',
  relatedTools: [],
};

export default meta;
