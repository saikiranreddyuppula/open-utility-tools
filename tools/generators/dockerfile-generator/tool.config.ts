import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-dockerfile-generator-v1',
  name: 'Dockerfile Generator',
  slug: 'dockerfile-generator',
  description:
    'Generate a best-practice Dockerfile for Node/Python/Go/Static from a form (base image, ports, multi-stage).',
  category: 'generators',
  tags: ['dockerfile', 'docker', 'container', 'devops', 'scaffold'],
  keywords: [
    'dockerfile',
    'docker',
    'container',
    'image',
    'multi-stage',
    'dockerignore',
    'healthcheck',
    'node',
    'python',
    'golang',
    'nginx',
  ],
  icon: 'Container',
  relatedTools: [],
};

export default meta;
