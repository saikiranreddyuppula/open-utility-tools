import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-http-message-parser-v1',
  name: 'Raw HTTP Message Parser',
  slug: 'web-http-message-parser',
  description: 'Parse a raw HTTP request or response into method, path, status, headers, and body.',
  category: 'web',
  tags: ['http', 'parse', 'headers', 'request', 'response'],
  keywords: ['raw http', 'http request', 'http response', 'parse headers', 'status line', 'http message'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
