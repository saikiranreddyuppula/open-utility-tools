import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-rsa-keypair-generator-v1',
  name: 'RSA Key Pair Generator',
  slug: 'rsa-keypair-generator',
  description:
    'Generate an RSA public/private key pair in PEM format with selectable key size (2048/3072/4096) and hash.',
  category: 'crypto',
  tags: ['rsa', 'key pair', 'pem'],
  keywords: ['rsa', 'key pair', 'pem', 'public key', 'private key', 'asymmetric'],
  icon: 'KeyRound',
  relatedTools: [],
};

export default meta;
