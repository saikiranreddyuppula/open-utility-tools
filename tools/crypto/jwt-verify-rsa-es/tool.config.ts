import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-jwt-verify-rsa-es-v1',
  name: 'JWT Verifier (RS/ES)',
  slug: 'jwt-verify-rsa-es',
  description:
    'Verify a JWT signature against an RSA or ECDSA public key and check standard claims.',
  category: 'crypto',
  tags: ['jwt', 'verify', 'rsa', 'ecdsa', 'signature'],
  keywords: ['rs256', 'es256', 'ps256', 'spki', 'jwk', 'public key', 'json web token'],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
