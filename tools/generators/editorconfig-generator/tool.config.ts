import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-editorconfig-generator-v1',
  name: '.editorconfig Generator',
  slug: 'editorconfig-generator',
  description:
    'Generate an .editorconfig from options: indent style/size, charset, EOL, trailing whitespace, per-glob rules.',
  category: 'generators',
  tags: ['editorconfig', 'config', 'indent', 'formatting', 'scaffold'],
  keywords: [
    'editorconfig',
    'indent_style',
    'indent_size',
    'charset',
    'end_of_line',
    'trailing whitespace',
    'final newline',
    'glob',
    'ini',
  ],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
