import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-curl-command-builder-v1',
  name: 'cURL Command Builder',
  slug: 'web-curl-command-builder',
  description:
    'Build a complete curl command from method, URL, headers, body, and auth fields.',
  category: 'web',
  tags: ['curl', 'http', 'request', 'api', 'builder', 'command'],
  keywords: [
    'curl',
    'command builder',
    'http request',
    'rest',
    'headers',
    'basic auth',
    'form data',
    'shell',
  ],
  icon: 'Terminal',
  relatedTools: [],
};

export default meta;
