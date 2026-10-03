import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-dockerfile-linter-v1',
  name: 'Dockerfile Linter',
  slug: 'dockerfile-linter',
  description:
    'Lint a Dockerfile against hadolint-style best practices (pinned images, apt/pip/npm hygiene, root user, secrets, layers) with line-by-line findings and fix hints.',
  category: 'web',
  tags: ['docker', 'dockerfile', 'lint', 'hadolint', 'devops'],
  keywords: [
    'dockerfile linter',
    'hadolint online',
    'dockerfile best practices',
    'dockerfile checker',
    'validate dockerfile',
    'docker security',
    'dockerfile analyzer',
    'dockerfile static analysis',
  ],
  icon: 'Container',
  relatedTools: [],
};

export default meta;
