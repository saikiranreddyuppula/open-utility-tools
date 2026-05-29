import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-rot47-v1',
  name: 'ROT47 Cipher',
  slug: 'rot47',
  description:
    'Encode or decode text with ROT47, rotating all visible ASCII characters by 47 positions for a reversible obfuscation.',
  category: 'text',
  tags: ['text', 'cipher', 'encoding'],
  keywords: ['rot47', 'cipher', 'obfuscate', 'encode', 'ascii'],
  icon: 'RotateCw',
  relatedTools: [],
};

export default meta;
