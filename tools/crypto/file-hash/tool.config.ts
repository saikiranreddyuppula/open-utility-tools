import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-file-hash-v1',
  name: 'File Hash',
  slug: 'file-hash',
  description:
    'Hash any local file with MD5, SHA-1, SHA-256, or SHA-512 by dropping it in, with a field to compare against an expected checksum.',
  category: 'crypto',
  tags: ['file', 'hash', 'checksum'],
  keywords: ['file hash', 'checksum', 'sha256', 'md5', 'verify', 'integrity'],
  icon: 'FileDigit',
  relatedTools: [],
};

export default meta;
