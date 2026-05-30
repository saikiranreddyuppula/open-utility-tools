import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-crypto-sha3-keccak-hash-v1',
  name: 'SHA-3 / Keccak Hash',
  slug: 'crypto-sha3-keccak-hash',
  description:
    'Computes SHA3-224/256/384/512 and Keccak-256 hashes of text using a pure JS implementation.',
  category: 'crypto',
  tags: ['sha3', 'keccak', 'hash', 'digest', 'ethereum'],
  keywords: ['sha3-256', 'keccak-256', 'keccak256', 'sponge', 'fips 202', 'checksum'],
  icon: 'Fingerprint',
  relatedTools: [],
};

export default meta;
