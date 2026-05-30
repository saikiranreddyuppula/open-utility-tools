import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generators-gitlab-ci-yaml-v1',
  name: 'GitLab CI Pipeline Generator',
  slug: 'generators-gitlab-ci-yaml',
  description: 'Builds a .gitlab-ci.yml from selected stages, jobs, images, and cache settings.',
  category: 'generators',
  tags: ['gitlab', 'ci', 'yaml', 'pipeline', 'devops'],
  keywords: ['gitlab-ci', 'pipeline', 'ci/cd', 'yaml', 'stages', 'jobs', 'cache'],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
