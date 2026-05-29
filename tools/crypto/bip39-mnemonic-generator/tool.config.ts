import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-bip39-mnemonic-generator-v1',
  name: 'BIP39 Mnemonic Generator',
  slug: 'bip39-mnemonic-generator',
  description:
    'Generate BIP39 seed phrases of 12, 15, 18, 21, or 24 words with a valid checksum for crypto wallet backups.',
  category: 'crypto',
  tags: ['bip39', 'mnemonic', 'seed phrase'],
  keywords: ['bip39', 'mnemonic', 'seed phrase', 'wallet', 'crypto', 'recovery'],
  icon: 'Coins',
  relatedTools: [],
};

export default meta;
