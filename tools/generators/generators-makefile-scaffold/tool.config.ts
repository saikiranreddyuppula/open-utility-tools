import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generators-makefile-scaffold-v1',
  name: 'Makefile Scaffold Generator',
  slug: 'generators-makefile-scaffold',
  description:
    'Generates a Makefile with .PHONY targets, variables, and help target from a list of tasks.',
  category: 'generators',
  tags: ['makefile', 'make', 'build', 'scaffold', 'devops'],
  keywords: ['makefile', 'make targets', 'phony', 'help target', 'build automation', 'variables'],
  icon: 'Hammer',
  relatedTools: [],
};

export default meta;
