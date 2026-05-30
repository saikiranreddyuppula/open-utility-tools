import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-crypto-passwd-shadow-parser-v1',
  name: '/etc/passwd & shadow Parser',
  slug: 'crypto-passwd-shadow-parser',
  description: 'Parse and explain Unix passwd and shadow file lines field by field.',
  category: 'crypto',
  tags: ['linux', 'passwd', 'shadow', 'unix', 'parser'],
  keywords: ['/etc/passwd', '/etc/shadow', 'uid gid', 'gecos', 'password hash', 'crypt id'],
  icon: 'FileLock',
  relatedTools: [],
};

export default meta;
