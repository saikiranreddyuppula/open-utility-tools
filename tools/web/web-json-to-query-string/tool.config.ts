import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-json-to-query-string-v1',
  name: 'JSON to Query Params',
  slug: 'web-json-to-query-string',
  description:
    'Turn a flat or nested JSON object into a properly encoded URL query string, with bracket notation for nested keys and arrays.',
  category: 'web',
  tags: ['json', 'query', 'url', 'encode'],
  keywords: ['json', 'query', 'url', 'params', 'encode', 'nested'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
