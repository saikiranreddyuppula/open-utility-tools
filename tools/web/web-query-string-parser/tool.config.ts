import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-query-string-parser-v1',
  name: 'Query String Parser',
  slug: 'web-query-string-parser',
  description:
    'Parse a raw query string into a readable key/value table or pretty JSON, expanding repeated keys and bracket notation into arrays.',
  category: 'web',
  tags: ['query', 'querystring', 'url', 'parse'],
  keywords: ['query', 'querystring', 'params', 'parse', 'json', 'url'],
  icon: 'Link2',
  relatedTools: [],
};

export default meta;
