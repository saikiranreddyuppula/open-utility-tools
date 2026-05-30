import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-crypto-text-checksum-multi-v1',
  name: 'Multi-Algorithm Text Checksum',
  slug: 'crypto-text-checksum-multi',
  description:
    'Computes CRC-8, CRC-16, CRC-32, Adler-32 and a simple XOR/sum checksum of text in one view.',
  category: 'crypto',
  tags: ['checksum', 'crc', 'adler32', 'crc32', 'hash'],
  keywords: ['crc8', 'crc16', 'crc32', 'modbus', 'ccitt', 'xor', 'bsd sum', 'integrity'],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
