import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-rot47-encoder-v1',
  name: 'ROT47 Encoder',
  slug: 'rot47-encoder',
  description:
    'Encode or decode text with ROT47, the printable-ASCII rotation cipher (its own inverse).',
  category: 'crypto',
  tags: ['cipher', 'rotation', 'ascii'],
  keywords: ['rot47', 'cipher', 'rotation', 'ascii', 'encode', 'decode'],
  icon: 'Shuffle',
  relatedTools: [],
};

export default meta;
