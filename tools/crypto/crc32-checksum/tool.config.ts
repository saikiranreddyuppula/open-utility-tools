import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-crc32-checksum-v1',
  name: 'CRC32 Checksum',
  slug: 'crc32-checksum',
  description:
    'Compute the CRC-32 checksum of any text, output as hex or unsigned decimal for quick integrity checks.',
  category: 'crypto',
  tags: ['crc32', 'checksum', 'integrity'],
  keywords: ['crc32', 'checksum', 'integrity', 'hash', 'verify', 'polynomial'],
  icon: 'CheckCheck',
  relatedTools: [],
};

export default meta;
