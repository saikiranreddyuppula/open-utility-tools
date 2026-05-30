import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-crypto-argon2-params-advisor-v1',
  name: 'Argon2 Parameter Advisor',
  slug: 'crypto-argon2-params-advisor',
  description: 'Recommend Argon2id memory, iteration, and parallelism parameters for a target environment.',
  category: 'crypto',
  tags: ['argon2', 'argon2id', 'password', 'kdf', 'owasp'],
  keywords: ['argon2', 'argon2id', 'rfc 9106', 'owasp', 'password hashing', 'memory cost', 'time cost', 'phc'],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
