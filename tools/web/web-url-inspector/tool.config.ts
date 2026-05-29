import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-url-inspector-v1',
  name: 'URL Inspector',
  slug: 'web-url-inspector',
  description:
    'Break a URL into protocol, host, port, path segments, query parameters, and hash, displayed as a clear labeled component breakdown.',
  category: 'web',
  tags: ['url', 'parse', 'inspect'],
  keywords: ['url', 'parse', 'components', 'host', 'path', 'inspect'],
  icon: 'Globe',
  relatedTools: [],
};

export default meta;
