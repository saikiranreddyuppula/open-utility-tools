import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-jwt-expiry-inspector-v1',
  name: 'JWT Expiry Inspector',
  slug: 'web-jwt-expiry-inspector',
  description: 'Decode a JWT and report human-readable issued/expiry times and remaining validity.',
  category: 'web',
  tags: ['jwt', 'token', 'expiry', 'auth', 'decode'],
  keywords: ['jwt', 'json web token', 'exp', 'iat', 'nbf', 'expiry', 'validity', 'bearer', 'auth token'],
  icon: 'Clock3',
  relatedTools: [],
};

export default meta;
