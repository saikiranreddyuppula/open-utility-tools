import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-css-minify-v1',
  name: 'CSS Minify / Beautify',
  slug: 'css-minify',
  description: 'Minify CSS to one line or beautify it with consistent indentation.',
  category: 'web',
  tags: ['css', 'minify', 'beautify', 'format', 'compress'],
  keywords: ['css minify', 'css beautify', 'format css', 'compress css', 'prettify'],
  icon: 'FileCode',
  relatedTools: ['json-formatter', 'html-to-text', 'markdown-to-html'],
};

export default meta;
