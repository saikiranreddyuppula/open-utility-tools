import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-query-string-to-json-v1',
  name: 'Query String to JSON',
  slug: 'query-string-to-json',
  category: 'convert',
  description:
    'Parse a URL query string into structured JSON, decoding values, grouping repeated keys into arrays, and rebuilding bracketed nesting.',
  tags: ['query', 'json', 'url', 'convert'],
  keywords: ['query string', 'json', 'url', 'params', 'parse', 'convert'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
