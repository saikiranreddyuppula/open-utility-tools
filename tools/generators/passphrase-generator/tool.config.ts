import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-passphrase-v1',
  name: 'Passphrase Generator',
  slug: 'passphrase-generator',
  description: 'Generate memorable multi-word passphrases (diceware-style) locally.',
  category: 'generators',
  tags: ['passphrase', 'diceware', 'password', 'words', 'memorable'],
  keywords: ['passphrase', 'diceware', 'word password', 'memorable password', 'xkcd'],
  icon: 'KeyRound',
  relatedTools: ['password-generator', 'uuid-generator', 'random-string'],
};

export default meta;
