import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-z85-encode-v1',
  name: 'Z85 Encode / Decode',
  slug: 'encoding-z85-encode',
  description: 'Encode/decode using ZeroMQ Z85, a printable Base85 variant safe for source code.',
  category: 'encoding',
  tags: ['z85', 'base85', 'zeromq', 'encode', 'decode'],
  keywords: ['z85', 'base85', 'zeromq', 'rfc 32', 'ascii85', 'binary to text'],
  icon: 'Code',
  relatedTools: [],
};

export default meta;
