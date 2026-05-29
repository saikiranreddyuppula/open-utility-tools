import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-html-to-jsx-v1',
  name: 'HTML to JSX',
  slug: 'web-html-to-jsx',
  description:
    'Convert raw HTML into React JSX, renaming class to className, fixing self-closing tags, camelCasing attributes, and converting inline styles to objects.',
  category: 'web',
  tags: ['html', 'jsx', 'react'],
  keywords: ['html', 'jsx', 'react', 'convert', 'className', 'component'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
