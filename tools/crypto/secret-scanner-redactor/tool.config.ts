import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-secret-scanner-redactor-v1',
  name: 'Secret Scanner & Redactor',
  slug: 'secret-scanner-redactor',
  description:
    'Scan pasted code, logs, configs, diffs or .env files for leaked API keys, tokens, passwords and private keys, then copy a redacted version that is safe to share.',
  category: 'crypto',
  tags: ['secrets', 'redact', 'security', 'api keys', 'leak'],
  keywords: [
    'secret scanner',
    'redact secrets',
    'api key detector',
    'leaked credentials',
    'env file',
    'gitleaks',
    'trufflehog',
    'mask password',
    'sanitize logs',
    'aws key',
    'github token',
    'private key',
    'jwt',
    'before sharing with ai',
  ],
  icon: 'ShieldCheck',
  relatedTools: ['jwt-decoder', 'password-strength-checker', 'hash-text'],
};

export default meta;
