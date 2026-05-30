import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-semver-bump-v1',
  name: 'Semver Version Bumper',
  slug: 'web-semver-bump',
  description: 'Compute the next semantic version by bumping major, minor, patch, or prerelease according to semver rules.',
  category: 'web',
  tags: ['semver', 'version', 'bump', 'npm', 'release'],
  keywords: ['increment version', 'major minor patch', 'prerelease', 'premajor', 'preminor', 'prepatch', 'alpha', 'beta'],
  icon: 'TrendingUp',
  relatedTools: [],
};

export default meta;
