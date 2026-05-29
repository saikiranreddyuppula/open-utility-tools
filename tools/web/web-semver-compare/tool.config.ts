import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-semver-compare-v1',
  name: 'Semantic Version Comparator',
  slug: 'web-semver-compare',
  description:
    'Compare two semantic versions to see which is greater, parse a version into major/minor/patch/prerelease, and test it against a range.',
  category: 'web',
  tags: ['semver', 'version', 'compare'],
  keywords: ['semver', 'version', 'compare', 'semantic', 'range', 'npm'],
  icon: 'GitCompare',
  relatedTools: [],
};

export default meta;
