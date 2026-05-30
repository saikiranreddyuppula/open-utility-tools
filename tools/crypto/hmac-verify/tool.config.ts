import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-hmac-verify-v1',
  name: 'HMAC Verify',
  slug: 'hmac-verify',
  description:
    'Recompute an HMAC over a message and key, then compare it against an expected MAC to verify authenticity.',
  category: 'crypto',
  tags: ['hmac', 'verify', 'mac', 'authentication', 'integrity'],
  keywords: ['hmac-sha256', 'sha-1', 'sha-512', 'message authentication', 'compare', 'webcrypto'],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
