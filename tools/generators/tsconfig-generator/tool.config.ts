import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-tsconfig-generator-v1',
  name: 'tsconfig.json Generator',
  slug: 'tsconfig-generator',
  description: 'Generate a tsconfig.json from target/module/strictness presets with include/exclude and path aliases.',
  category: 'generators',
  tags: ['typescript', 'tsconfig', 'config', 'compiler', 'json'],
  keywords: ['tsconfig.json', 'typescript config', 'compilerOptions', 'strict', 'paths alias', 'moduleResolution'],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
