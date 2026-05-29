import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-random-bytes-generator-v1',
  name: 'Random Bytes Generator',
  slug: 'random-bytes-generator',
  description:
    'Generate cryptographically secure random bytes as hex, Base64, Base64URL, or a C-style byte array of a chosen length.',
  category: 'crypto',
  tags: ['random', 'bytes', 'crypto'],
  keywords: ['random bytes', 'secure random', 'hex', 'nonce', 'iv', 'entropy'],
  icon: 'Sparkles',
  relatedTools: [],
};

export default meta;
