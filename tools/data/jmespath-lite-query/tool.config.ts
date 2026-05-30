import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-jmespath-lite-query-v1',
  name: 'JSON Query (JMESPath-lite)',
  slug: 'jmespath-lite-query',
  description: 'Query JSON with a JMESPath-style path and filter expression.',
  category: 'data',
  tags: ['json', 'query', 'jmespath', 'filter', 'path'],
  keywords: ['json', 'query', 'jmespath', 'filter', 'projection', 'jsonpath', 'select', 'wildcard'],
  icon: 'FileSearch',
  relatedTools: [],
};

export default meta;
