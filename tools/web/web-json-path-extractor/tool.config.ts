import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-json-path-extractor-v1',
  name: 'JSON Path Extractor',
  slug: 'web-json-path-extractor',
  description:
    'Query a JSON document with a dot/bracket path expression (e.g. data.items[0].name) and extract matching values, with wildcard support for arrays.',
  category: 'web',
  tags: ['json', 'query', 'path'],
  keywords: ['json', 'jsonpath', 'query', 'extract', 'filter', 'path'],
  icon: 'FileSearch',
  relatedTools: [],
};

export default meta;
