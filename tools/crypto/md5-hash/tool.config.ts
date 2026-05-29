import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-md5-hash-v1',
  name: 'MD5 Hash Generator',
  slug: 'md5-hash',
  description:
    'Generate the MD5 hash of any text, with lowercase or uppercase hex output (the algorithm Web Crypto omits).',
  category: 'crypto',
  tags: ['md5', 'hash', 'digest'],
  keywords: ['md5', 'hash', 'checksum', 'digest', 'fingerprint', 'message digest'],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
