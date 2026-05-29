import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-jwt-verify-hmac-v1',
  name: 'JWT Signature Verifier (HS256)',
  slug: 'jwt-verify-hmac',
  description:
    'Verify an HMAC-signed JWT (HS256/384/512) against a secret and report whether the signature and expiry are valid.',
  category: 'crypto',
  tags: ['jwt', 'hmac', 'verify'],
  keywords: ['jwt', 'verify', 'hs256', 'hmac', 'signature', 'validate'],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
