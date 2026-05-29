import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-http-status-codes-v1',
  name: 'HTTP Status Codes',
  slug: 'http-status-codes',
  description: 'Searchable reference of HTTP status codes and their meanings.',
  category: 'web',
  tags: ['http', 'status', 'codes', 'reference', '404', '500'],
  keywords: ['http status', 'status codes', '404', '500', '200', 'reference', 'response codes'],
  icon: 'Globe',
  relatedTools: ['mime-types', 'url-parser', 'jwt-decoder'],
};

export default meta;
