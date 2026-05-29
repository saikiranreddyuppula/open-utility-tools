import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-formatter-v1',
  name: 'JSON Formatter',
  slug: 'json-formatter',
  description: 'Pretty-print, minify, and validate JSON with configurable indentation.',
  category: 'data',
  tags: ['json', 'format', 'beautify', 'minify', 'validate'],
  keywords: ['json', 'pretty', 'prettify', 'beautify', 'minify', 'validate', 'lint'],
  icon: 'Braces',
  relatedTools: ['json-minify', 'json-to-csv', 'yaml-to-json'],
};

export default meta;
