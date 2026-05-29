import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-query-params-v1',
  name: 'Query String ↔ JSON',
  slug: 'query-params',
  description: 'Convert a URL query string to JSON and back, handling repeated keys.',
  category: 'web',
  tags: ['query', 'querystring', 'json', 'params', 'url'],
  keywords: ['query string', 'querystring', 'params to json', 'url params', 'searchparams'],
  icon: 'Link2',
  relatedTools: ['url-parser', 'url-encode', 'json-formatter'],
};

export default meta;
