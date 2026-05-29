import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-bcrypt-v1',
  name: 'Bcrypt Hash & Verify',
  slug: 'bcrypt',
  description: 'Hash a password with bcrypt and verify a password against a hash, locally.',
  category: 'crypto',
  tags: ['bcrypt', 'password', 'hash', 'verify', 'salt'],
  keywords: ['bcrypt', 'password hash', 'verify password', 'salt rounds', 'hash password'],
  icon: 'LockKeyhole',
  relatedTools: ['hash-text', 'hmac-generator', 'password-generator'],
  loadWasm: true,
};

export default meta;
