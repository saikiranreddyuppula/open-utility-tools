import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-cookie-string-builder-v1',
  name: 'Set-Cookie String Builder',
  slug: 'web-cookie-string-builder',
  description:
    'Build a Set-Cookie header from name, value and attributes with validation.',
  category: 'web',
  tags: ['http', 'cookies', 'headers', 'security', 'samesite'],
  keywords: [
    'set-cookie',
    'samesite',
    'httponly',
    'secure',
    'max-age',
    'partitioned',
    '__host-',
    'cookie header',
  ],
  icon: 'Cookie',
  relatedTools: [],
};

export default meta;
