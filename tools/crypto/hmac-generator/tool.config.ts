import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-hmac-generator-v1',
  name: 'HMAC Generator',
  slug: 'hmac-generator',
  description: 'Compute HMAC (SHA-1/256/384/512) of a message with a secret key.',
  category: 'crypto',
  tags: ['hmac', 'mac', 'sha256', 'signature', 'hash'],
  keywords: ['hmac', 'message authentication', 'sign', 'secret key', 'sha'],
  icon: 'Fingerprint',
  relatedTools: ['hash-text', 'jwt-decoder', 'password-generator'],
  loadWasm: true,
};

export default meta;
