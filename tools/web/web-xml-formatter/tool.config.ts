import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-xml-formatter-v1',
  name: 'XML Formatter',
  slug: 'web-xml-formatter',
  description:
    'Pretty-print and indent minified XML, or minify verbose XML by stripping whitespace between tags, with self-closing tag handling.',
  category: 'web',
  tags: ['xml', 'format', 'beautify'],
  keywords: ['xml', 'format', 'beautify', 'minify', 'pretty', 'indent'],
  icon: 'Code2',
  relatedTools: [],
};

export default meta;
