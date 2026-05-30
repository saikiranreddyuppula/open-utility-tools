import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-set-cookie-builder-v1',
  name: 'Set-Cookie Header Builder',
  slug: 'web-set-cookie-builder',
  description:
    'Build a syntactically correct Set-Cookie header from name, value, and attribute toggles.',
  category: 'web',
  tags: ['http', 'cookie', 'headers', 'security'],
  keywords: [
    'set-cookie',
    'cookie',
    'samesite',
    'httponly',
    'secure',
    '__host-',
    'max-age',
    'rfc 6265',
    'header',
  ],
  icon: 'Cookie',
  relatedTools: [],
};

export default meta;
