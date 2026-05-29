import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-curl-to-fetch-v1',
  name: 'cURL to Code',
  slug: 'web-curl-to-fetch',
  description:
    'Convert a curl command into a browser fetch() call, parsing method, URL, headers, and body into ready-to-paste JavaScript.',
  category: 'web',
  tags: ['curl', 'fetch', 'javascript', 'http'],
  keywords: ['curl', 'fetch', 'javascript', 'http', 'request', 'convert'],
  icon: 'Terminal',
  relatedTools: [],
};

export default meta;
