import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-password-generator-v1',
  name: 'Password Generator',
  slug: 'password-generator',
  description: 'Generate strong random passwords or diceware passphrases, locally.',
  category: 'crypto',
  tags: ['password', 'passphrase', 'random', 'secure', 'diceware'],
  keywords: ['password', 'passphrase', 'generator', 'random', 'secure', 'diceware', 'strength'],
  icon: 'KeyRound',
  relatedTools: ['uuid-generator', 'hmac-generator', 'hash-text'],
};

export default meta;
