import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-gitignore-v1',
  name: '.gitignore Generator',
  slug: 'gitignore-generator',
  description: 'Assemble a .gitignore from common language and tool templates.',
  category: 'generators',
  tags: ['gitignore', 'git', 'template', 'ignore'],
  keywords: ['gitignore', 'git ignore', 'template', 'node', 'python', 'rust'],
  icon: 'FileCog',
  relatedTools: ['uuid-generator', 'password-generator', 'lorem-ipsum'],
};

export default meta;
