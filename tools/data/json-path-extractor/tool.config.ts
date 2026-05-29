import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-path-extractor-v1',
  name: 'JSON Path Extractor',
  slug: 'json-path-extractor',
  description: 'Pull values out of JSON with a dot/bracket path like data.items[0].name.',
  category: 'data',
  tags: ['json', 'query', 'extract'],
  keywords: ['json', 'jsonpath', 'query', 'extract', 'path'],
  icon: 'FileSearch',
  relatedTools: [],
};

export default meta;
