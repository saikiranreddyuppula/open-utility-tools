import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-jwt-decoder-v1',
  name: 'JWT Decoder',
  slug: 'jwt-decoder',
  description: 'Decode and inspect JSON Web Token header & payload (no verification).',
  category: 'web',
  tags: ['jwt', 'token', 'json web token', 'decode', 'auth'],
  keywords: ['jwt', 'jws', 'bearer', 'claims', 'token', 'auth', 'oauth'],
  icon: 'KeyRound',
  relatedTools: ['base64-text', 'json-formatter', 'hash-text'],
};

export default meta;
