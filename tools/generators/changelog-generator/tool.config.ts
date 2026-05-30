import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-changelog-generator-v1',
  name: 'CHANGELOG Generator (Keep a Changelog)',
  slug: 'changelog-generator',
  description: 'Scaffold a Keep-a-Changelog / SemVer CHANGELOG.md with version sections and Added/Changed/Fixed groups.',
  category: 'generators',
  tags: ['changelog', 'keep-a-changelog', 'semver', 'markdown', 'release'],
  keywords: ['changelog', 'keep a changelog', 'release notes', 'semver', 'changelog.md', 'version history'],
  icon: 'FileStack',
  relatedTools: [],
};

export default meta;
