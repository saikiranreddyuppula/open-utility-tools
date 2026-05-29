import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-hex-text-v1',
  name: 'Hex Encode / Decode',
  slug: 'hex-text',
  description: 'Convert text to hexadecimal and back, with optional uppercase.',
  category: 'encoding',
  tags: ['hex', 'hexadecimal', 'base16', 'encode', 'decode'],
  keywords: ['hex', 'hexadecimal', 'base16', 'bytes', 'encode', 'decode'],
  icon: 'Binary',
  relatedTools: ['base64-text', 'base32-text', 'hash-text'],
  loadWasm: true,
};

export default meta;
