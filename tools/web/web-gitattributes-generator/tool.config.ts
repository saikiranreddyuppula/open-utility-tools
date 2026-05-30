import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-gitattributes-generator-v1',
  name: '.gitattributes Generator',
  slug: 'web-gitattributes-generator',
  description:
    'Generate a .gitattributes file selecting line-ending normalization, binary, LFS and linguist rules from presets.',
  category: 'web',
  tags: ['git', 'gitattributes', 'generator', 'lfs', 'linguist', 'line-endings'],
  keywords: [
    'gitattributes',
    'git lfs',
    'linguist',
    'line endings',
    'text auto',
    'eol',
    'binary',
    'export-ignore',
  ],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
