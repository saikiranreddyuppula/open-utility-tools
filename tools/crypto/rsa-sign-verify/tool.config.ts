import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-rsa-sign-verify-v1',
  name: 'RSA Sign & Verify',
  slug: 'rsa-sign-verify',
  description:
    'Sign messages with an RSA private key and verify signatures with a public key (RSASSA-PKCS1 / PSS).',
  category: 'crypto',
  tags: ['rsa', 'sign', 'verify', 'signature', 'pss'],
  keywords: ['rsassa', 'pkcs1', 'pkcs8', 'spki', 'pem', 'digital signature'],
  icon: 'FileBadge',
  relatedTools: [],
};

export default meta;
