import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-chmod-v1',
  name: 'Chmod Calculator',
  slug: 'chmod-calculator',
  description: 'Toggle Unix permission bits and get the octal + symbolic chmod value.',
  category: 'web',
  tags: ['chmod', 'permissions', 'unix', 'octal', 'file'],
  keywords: ['chmod', 'file permissions', 'octal', 'rwx', 'unix permissions', '755'],
  icon: 'Lock',
  relatedTools: ['number-base-converter', 'gitignore-generator', 'mime-types'],
};

export default meta;
