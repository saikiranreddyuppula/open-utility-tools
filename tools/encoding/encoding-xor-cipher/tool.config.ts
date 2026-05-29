import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-xor-cipher-v1',
  name: 'XOR Cipher',
  slug: 'encoding-xor-cipher',
  description:
    'Encrypt or decrypt text with a repeating-key XOR cipher, outputting or reading hex or Base64.',
  category: 'encoding',
  tags: ['xor', 'cipher', 'key', 'encrypt', 'decrypt', 'encode'],
  keywords: ['xor', 'cipher', 'key', 'encrypt', 'decrypt', 'encode'],
  icon: 'Lock',
  relatedTools: [],
};

export default meta;
