import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-diceware-passphrase-v1',
  name: 'Diceware Passphrase Generator',
  slug: 'diceware-passphrase',
  description:
    'Generate memorable passphrases from a bundled Diceware-style 7776-word list using cryptographic randomness.',
  category: 'crypto',
  tags: ['diceware', 'passphrase', 'password', 'random', 'entropy', 'security'],
  keywords: [
    'diceware',
    'passphrase',
    'word password',
    'eff wordlist',
    '7776',
    'dice',
    'memorable password',
    'random words',
  ],
  icon: 'Dice5',
  relatedTools: [],
};

export default meta;
