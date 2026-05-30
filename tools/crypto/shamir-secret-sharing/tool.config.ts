import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-shamir-secret-sharing-v1',
  name: 'Shamir Secret Sharing',
  slug: 'shamir-secret-sharing',
  description:
    'Split a secret into N shares requiring K to reconstruct, using finite-field polynomial interpolation.',
  category: 'crypto',
  tags: ['shamir', 'secret', 'sharing', 'threshold', 'split'],
  keywords: ['sss', 'gf256', 'lagrange', 'reconstruct', 'shares', 'key splitting'],
  icon: 'Combine',
  relatedTools: [],
};

export default meta;
