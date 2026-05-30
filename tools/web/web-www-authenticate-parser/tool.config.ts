import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-www-authenticate-parser-v1',
  name: 'WWW-Authenticate Parser',
  slug: 'web-www-authenticate-parser',
  description: 'Parse WWW-Authenticate / Authorization challenge headers into scheme and parameters.',
  category: 'web',
  tags: ['http', 'auth', 'header', 'bearer', 'parser'],
  keywords: ['www-authenticate', 'proxy-authenticate', 'digest', 'basic', 'oauth', 'challenge', 'realm'],
  icon: 'LockKeyhole',
  relatedTools: [],
};

export default meta;
