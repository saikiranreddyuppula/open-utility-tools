import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generators-htaccess-basic-auth-v1',
  name: 'htpasswd + .htaccess Generator',
  slug: 'generators-htaccess-basic-auth',
  description: 'Generate matching htpasswd credentials and .htaccess block for HTTP Basic Auth.',
  category: 'generators',
  tags: ['apache', 'htaccess', 'htpasswd', 'auth', 'security'],
  keywords: ['basic auth', 'htpasswd', 'htaccess', 'apr1', 'md5', 'apache', 'password hash'],
  icon: 'LockKeyhole',
  relatedTools: [],
};

export default meta;
