import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-readme-scaffold-generator-v1',
  name: 'README.md Scaffold Generator',
  slug: 'readme-scaffold-generator',
  description:
    'Build a structured README.md from a form: title, badges, install, usage, features, license sections.',
  category: 'generators',
  tags: ['readme', 'markdown', 'documentation', 'scaffold', 'generator'],
  keywords: [
    'readme generator',
    'markdown readme',
    'project docs',
    'shields badges',
    'table of contents',
    'open source',
  ],
  icon: 'FileText',
  relatedTools: [],
};

export default meta;
