import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-hash-text-v1',
  name: 'Hash Text',
  slug: 'hash-text',
  description:
    'Compute MD5, SHA-1, SHA-256/384/512, SHA-3, BLAKE3 and CRC32 digests of text — live, in your browser.',
  category: 'crypto',
  tags: ['md5', 'sha256', 'sha512', 'blake3', 'crc32', 'digest'],
  keywords: ['hash', 'checksum', 'digest', 'sha', 'md5', 'blake3', 'fingerprint'],
  icon: 'Hash',
  relatedTools: ['hmac-generator', 'hash-file', 'base64-text'],
  loadWasm: true,
};

export default meta;
