import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-zero-width-steganography-v1',
  name: 'Zero-Width Character Encoder',
  slug: 'encoding-zero-width-steganography',
  description:
    'Hide a secret message inside cover text using invisible zero-width characters, and extract it.',
  category: 'encoding',
  tags: ['steganography', 'zero-width', 'hidden', 'invisible', 'encode'],
  keywords: ['zero width', 'steganography', 'invisible text', 'hidden message', 'unicode', 'obfuscation'],
  icon: 'Ghost',
  relatedTools: [],
};

export default meta;
