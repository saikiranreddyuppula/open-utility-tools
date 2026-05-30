import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-querystring-to-curl-v1',
  name: 'Query String to cURL',
  slug: 'querystring-to-curl',
  description: 'Build a curl command from a base URL and query string.',
  category: 'convert',
  tags: ['curl', 'query string', 'url', 'http', 'convert'],
  keywords: ['querystring to curl', 'curl builder', 'data-urlencode', 'http request', 'url params'],
  icon: 'Link',
  relatedTools: [],
};

export default meta;
