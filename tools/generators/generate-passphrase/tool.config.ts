import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-passphrase-v1',
  name: 'Secure Passphrase Generator',
  slug: 'generate-passphrase',
  description:
    'Generate memorable Diceware-style passphrases from a built-in wordlist with configurable word count, separator, capitalization, and an appended number.',
  category: 'generators',
  tags: ['passphrase', 'password', 'diceware'],
  keywords: ['passphrase', 'diceware', 'password', 'memorable', 'words', 'secure'],
  icon: 'LockKeyhole',
  relatedTools: [],
};

export default meta;
