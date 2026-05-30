import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-pbkdf2-key-derivation-v1',
  name: 'PBKDF2 Key Derivation',
  slug: 'pbkdf2-key-derivation',
  description: 'Derive a key from a passphrase and salt using PBKDF2 with configurable iterations and hash.',
  category: 'crypto',
  tags: ['pbkdf2', 'kdf', 'key-derivation', 'hash', 'password'],
  keywords: ['derive key', 'salt', 'iterations', 'sha-256', 'webcrypto', 'deriveBits'],
  icon: 'KeyRound',
  relatedTools: [],
};

export default meta;
