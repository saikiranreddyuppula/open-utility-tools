import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-base32-text-v1',
  name: 'Base32 Encode / Decode',
  slug: 'base32-text',
  description: 'Encode text to RFC 4648 Base32 and decode it back.',
  category: 'encoding',
  tags: ['base32', 'rfc4648', 'encode', 'decode'],
  keywords: ['base32', 'rfc 4648', 'encode', 'decode'],
  icon: 'Binary',
  relatedTools: ['base64-text', 'hex-text', 'hash-text'],
  loadWasm: true,
};

export default meta;
