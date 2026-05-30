import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-cache-busting-hash-appender-v1',
  name: 'Asset Cache-Busting URL Builder',
  slug: 'web-cache-busting-hash-appender',
  description:
    'Appends a deterministic version/hash query param to a list of asset URLs.',
  category: 'web',
  tags: ['cache', 'cache-busting', 'url', 'version', 'assets'],
  keywords: [
    'cache busting',
    'asset version',
    'query param',
    'fingerprint',
    'hash',
    'static assets',
    'cdn',
  ],
  icon: 'Link2',
  relatedTools: [],
};

export default meta;
