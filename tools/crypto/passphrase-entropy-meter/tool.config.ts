import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-passphrase-entropy-meter-v1',
  name: 'Passphrase Entropy Meter',
  slug: 'passphrase-entropy-meter',
  description: 'Estimate the bits of entropy in a passphrase based on its character set and length.',
  category: 'crypto',
  tags: ['entropy', 'password', 'security', 'strength', 'passphrase'],
  keywords: ['password strength', 'bits of entropy', 'crack time', 'guess', 'charset'],
  icon: 'Gauge',
  relatedTools: [],
};

export default meta;
