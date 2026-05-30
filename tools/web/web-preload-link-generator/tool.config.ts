import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-preload-link-generator-v1',
  name: 'Resource Hint Link Generator',
  slug: 'web-preload-link-generator',
  description:
    'Generate preload, prefetch, preconnect and dns-prefetch link tags.',
  category: 'web',
  tags: ['performance', 'preload', 'resource-hints', 'html'],
  keywords: [
    'preload',
    'prefetch',
    'preconnect',
    'dns-prefetch',
    'modulepreload',
    'resource hints',
    'link rel',
    'performance',
  ],
  icon: 'Rocket',
  relatedTools: [],
};

export default meta;
