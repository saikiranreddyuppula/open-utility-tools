import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-fletcher-checksum-v1',
  name: 'Fletcher-16/32/64 Checksum',
  slug: 'fletcher-checksum',
  description: 'Compute Fletcher checksums (16, 32, and 64-bit) of input bytes.',
  category: 'crypto',
  tags: ['fletcher', 'checksum', 'hash', 'integrity'],
  keywords: ['fletcher-16', 'fletcher-32', 'fletcher-64', 'modular sum', 'error detection'],
  icon: 'FileDigit',
  relatedTools: [],
};

export default meta;
