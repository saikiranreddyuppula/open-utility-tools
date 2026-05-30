import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-base85-rfc1924-v1',
  name: 'Base85 (RFC 1924 / ZeroMQ) Variants',
  slug: 'encoding-base85-rfc1924',
  description:
    'Encodes and decodes data across Base85 alphabets: ASCII85, RFC 1924, and Z85 side by side.',
  category: 'encoding',
  tags: ['base85', 'ascii85', 'z85', 'rfc1924', 'encode'],
  keywords: [
    'base85',
    'ascii85',
    'z85',
    'rfc 1924',
    'zeromq',
    'adobe',
    'encode',
    'decode',
  ],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
