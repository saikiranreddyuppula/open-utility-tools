import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-adler32-checksum-v1',
  name: 'Adler-32 Checksum',
  slug: 'adler32-checksum',
  description: 'Compute the Adler-32 checksum of text or a file, as used by zlib.',
  category: 'crypto',
  tags: ['adler32', 'checksum', 'hash', 'zlib', 'integrity'],
  keywords: ['adler-32', 'rfc 1950', 'zlib checksum', 'file checksum', 'integrity'],
  icon: 'FileDigit',
  relatedTools: [],
};

export default meta;
