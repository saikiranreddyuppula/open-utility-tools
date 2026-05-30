import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-htpasswd-generator-v1',
  name: '.htpasswd Generator',
  slug: 'htpasswd-generator',
  description:
    'Generate Apache/Nginx htpasswd entries with bcrypt, SHA-1, or MD5(APR1) hashing, fully in-browser.',
  category: 'generators',
  tags: ['htpasswd', 'apache', 'nginx', 'bcrypt', 'auth'],
  keywords: [
    'htpasswd',
    'basic auth',
    'apache password',
    'nginx auth',
    'bcrypt',
    'apr1',
    'md5 crypt',
    'sha1',
  ],
  icon: 'LockKeyhole',
  relatedTools: [],
};

export default meta;
