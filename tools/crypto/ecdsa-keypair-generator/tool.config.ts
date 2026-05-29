import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-ecdsa-keypair-generator-v1',
  name: 'ECDSA Key Pair Generator',
  slug: 'ecdsa-keypair-generator',
  description: 'Generate an elliptic-curve (P-256/P-384/P-521) key pair as PEM for ECDSA signing.',
  category: 'crypto',
  tags: ['ecdsa', 'elliptic curve', 'pem'],
  keywords: ['ecdsa', 'elliptic curve', 'key pair', 'pem', 'p-256', 'signing'],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
