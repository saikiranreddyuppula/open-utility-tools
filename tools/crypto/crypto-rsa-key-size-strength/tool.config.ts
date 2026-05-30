import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-crypto-rsa-key-size-strength-v1',
  name: 'RSA / ECC Key Strength Comparator',
  slug: 'crypto-rsa-key-size-strength',
  description: 'Compare RSA, ECC, and symmetric key sizes by equivalent bits of security.',
  category: 'crypto',
  tags: ['rsa', 'ecc', 'key-size', 'security', 'reference'],
  keywords: ['nist sp 800-57', 'equivalent strength', 'secp256r1', 'aes', 'modulus', 'curve'],
  icon: 'Scale',
  relatedTools: [],
};

export default meta;
