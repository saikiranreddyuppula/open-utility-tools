import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-xor-cipher-v1',
  name: 'XOR Cipher',
  slug: 'xor-cipher',
  description:
    'Encrypt or decrypt text with a repeating-key XOR, output as hex or Base64 and back.',
  category: 'crypto',
  tags: ['cipher', 'xor', 'encrypt'],
  keywords: ['xor', 'cipher', 'encrypt', 'decrypt', 'repeating key', 'obfuscate'],
  icon: 'Blend',
  relatedTools: [],
};

export default meta;
