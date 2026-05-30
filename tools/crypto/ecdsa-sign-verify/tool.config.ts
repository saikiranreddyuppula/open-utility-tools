import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-ecdsa-sign-verify-v1',
  name: 'ECDSA Sign & Verify',
  slug: 'ecdsa-sign-verify',
  description: 'Sign and verify messages with ECDSA over P-256/P-384/P-521 curves.',
  category: 'crypto',
  tags: ['ecdsa', 'signature', 'sign', 'verify', 'pem'],
  keywords: ['p-256', 'p-384', 'p-521', 'pkcs8', 'spki', 'webcrypto', 'r||s', 'signing'],
  icon: 'FileKey',
  relatedTools: [],
};

export default meta;
