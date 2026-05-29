import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-url-parser-v1',
  name: 'URL Parser',
  slug: 'url-parser',
  description: 'Break a URL into protocol, host, path, query parameters and hash.',
  category: 'web',
  tags: ['url', 'parse', 'query', 'components', 'uri'],
  keywords: ['url parser', 'query string', 'parse url', 'components', 'parameters'],
  icon: 'Link',
  relatedTools: ['url-encode', 'query-params', 'jwt-decoder'],
};

export default meta;
