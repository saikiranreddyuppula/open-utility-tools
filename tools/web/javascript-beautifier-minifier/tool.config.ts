import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-javascript-beautifier-minifier-v1',
  name: 'JavaScript Beautifier & Minifier',
  slug: 'javascript-beautifier-minifier',
  description:
    'Beautify messy JavaScript with consistent indentation or minify it by stripping comments and whitespace, with ASI-safe output and no renaming, entirely in your browser.',
  category: 'web',
  tags: ['javascript', 'js', 'beautify', 'minify', 'format'],
  keywords: [
    'javascript beautifier',
    'javascript minifier',
    'js formatter',
    'js prettifier',
    'minify js',
    'uglify alternative',
    'format javascript online',
    'whitespace minifier',
    'remove comments javascript',
  ],
  icon: 'FileCode',
  relatedTools: ['css-minify', 'web-html-minify', 'json-formatter'],
};

export default meta;
