import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-basic-auth-v1',
  name: 'Basic Auth Generator',
  slug: 'basic-auth-generator',
  description: 'Build an HTTP Basic Authorization header from a username and password.',
  category: 'web',
  tags: ['basic auth', 'authorization', 'header', 'base64'],
  keywords: ['basic auth', 'authorization header', 'http auth', 'credentials', 'base64'],
  icon: 'Lock',
  relatedTools: ['base64-text', 'jwt-decoder', 'http-status-codes'],
};

export default meta;
