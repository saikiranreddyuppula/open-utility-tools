import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-jwt-generator-v1',
  name: 'JWT Generator',
  slug: 'jwt-generator',
  description: 'Create a signed HS256/384/512 JSON Web Token from a payload and secret.',
  category: 'crypto',
  tags: ['jwt', 'sign', 'token', 'hmac', 'hs256'],
  keywords: ['jwt generator', 'sign jwt', 'create token', 'hs256', 'json web token'],
  icon: 'KeyRound',
  relatedTools: ['jwt-decoder', 'hmac-generator', 'hash-text'],
};

export default meta;
