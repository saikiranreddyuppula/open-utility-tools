import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-github-actions-workflow-generator-v1',
  name: 'GitHub Actions Workflow Generator',
  slug: 'github-actions-workflow-generator',
  description:
    'Scaffold a CI workflow YAML (Node/Python/Go) with triggers, matrix, cache, and steps from a form.',
  category: 'generators',
  tags: ['github-actions', 'ci', 'yaml', 'workflow', 'devops'],
  keywords: [
    'github actions',
    'ci/cd',
    'workflow yaml',
    'ci.yml',
    'matrix build',
    'pipeline',
    'continuous integration',
  ],
  icon: 'Webhook',
  relatedTools: [],
};

export default meta;
