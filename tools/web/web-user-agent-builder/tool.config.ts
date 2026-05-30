import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-user-agent-builder-v1',
  name: 'User-Agent String Builder',
  slug: 'web-user-agent-builder',
  description:
    'Compose a browser User-Agent string from platform, engine, and version selectors.',
  category: 'web',
  tags: ['user-agent', 'http', 'browser', 'headers', 'testing'],
  keywords: [
    'ua string',
    'user agent generator',
    'navigator.userAgent',
    'browser identification',
    'googlebot',
    'curl',
    'spoof',
  ],
  icon: 'Smartphone',
  relatedTools: [],
};

export default meta;
