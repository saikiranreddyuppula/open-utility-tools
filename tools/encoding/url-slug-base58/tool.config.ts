import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-base58-v1',
  name: 'Base58 Encode / Decode',
  slug: 'base58',
  description: 'Encode bytes/text to Base58 (Bitcoin alphabet) and decode it back.',
  category: 'encoding',
  tags: ['base58', 'bitcoin', 'encode', 'decode'],
  keywords: ['base58', 'bitcoin', 'btc', 'encode', 'decode', 'base58check'],
  icon: 'Binary',
  relatedTools: ['base64-text', 'base32-text', 'hex-text'],
};

export default meta;
