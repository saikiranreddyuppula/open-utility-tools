import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-url-path-joiner-v1',
  name: 'URL Path Joiner & Normalizer',
  slug: 'web-url-path-joiner',
  description:
    'Join a base URL with path segments and normalize slashes, dot-segments, and trailing slashes safely.',
  category: 'web',
  tags: ['url', 'path', 'join', 'normalize', 'segments'],
  keywords: ['path join', 'slashes', 'dot segments', 'trailing slash', 'rfc 3986', 'concatenate'],
  icon: 'Link2',
  relatedTools: [],
};

export default meta;
