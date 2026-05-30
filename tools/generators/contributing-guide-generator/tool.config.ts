import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-contributing-guide-generator-v1',
  name: 'CONTRIBUTING.md Generator',
  slug: 'contributing-guide-generator',
  description: 'Generate a CONTRIBUTING.md with setup, branch/commit conventions, PR checklist, and code-of-conduct link.',
  category: 'generators',
  tags: ['contributing', 'open-source', 'markdown', 'documentation', 'github'],
  keywords: ['contributing.md', 'contribution guide', 'open source docs', 'pull request', 'github', 'community'],
  icon: 'Users',
  relatedTools: [],
};

export default meta;
