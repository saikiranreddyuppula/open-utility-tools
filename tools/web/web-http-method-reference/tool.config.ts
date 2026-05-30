import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-http-method-reference-v1',
  name: 'HTTP Method Reference',
  slug: 'web-http-method-reference',
  description:
    'Cheatsheet of HTTP methods with safe/idempotent/cacheable/body semantics.',
  category: 'web',
  tags: ['http', 'methods', 'reference', 'rest', 'rfc'],
  keywords: [
    'http method',
    'verb',
    'get post put delete',
    'idempotent',
    'safe method',
    'cacheable',
    'webdav',
    'rfc 9110',
  ],
  icon: 'Send',
  relatedTools: [],
};

export default meta;
