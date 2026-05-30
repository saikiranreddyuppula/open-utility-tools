import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-scrypt-style-kdf-params-v1',
  name: 'KDF Parameter Planner',
  slug: 'scrypt-style-kdf-params',
  description: 'Compute memory, time, and output sizes for PBKDF2/scrypt/Argon2 parameter sets without running them.',
  category: 'crypto',
  tags: ['kdf', 'scrypt', 'argon2', 'pbkdf2', 'planner'],
  keywords: ['key derivation', 'memory cost', 'owasp', 'n r p', 'parameters', 'tuning'],
  icon: 'Calculator',
  relatedTools: [],
};

export default meta;
