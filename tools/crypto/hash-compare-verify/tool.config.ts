import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-hash-compare-verify-v1',
  name: 'Hash Compare & Verify',
  slug: 'hash-compare-verify',
  description:
    'Paste an expected checksum and your text or file hash to confirm they match with constant-time-style comparison.',
  category: 'crypto',
  tags: ['hash', 'verify', 'checksum', 'compare', 'integrity'],
  keywords: ['md5', 'sha-1', 'sha-256', 'sha-512', 'file hash', 'match', 'digest'],
  icon: 'CheckCheck',
  relatedTools: [],
};

export default meta;
