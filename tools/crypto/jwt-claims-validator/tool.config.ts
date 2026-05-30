import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-jwt-claims-validator-v1',
  name: 'JWT Claims Validator',
  slug: 'jwt-claims-validator',
  description:
    'Decode a JWT and check its registered claims (exp, nbf, iat, aud, iss) without verifying the signature.',
  category: 'crypto',
  tags: ['jwt', 'claims', 'validate', 'decode', 'token'],
  keywords: ['exp', 'nbf', 'iat', 'audience', 'issuer', 'expiry', 'json web token'],
  icon: 'ClipboardCheck',
  relatedTools: [],
};

export default meta;
