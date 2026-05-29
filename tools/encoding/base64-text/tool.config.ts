import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-base64-text-v1',
  name: 'Base64 Encode / Decode',
  slug: 'base64-text',
  description: 'Encode text to Base64 (standard or URL-safe) and decode it back — live.',
  category: 'encoding',
  tags: ['base64', 'b64', 'url-safe', 'encode', 'decode'],
  keywords: ['base64', 'b64', 'atob', 'btoa', 'url safe', 'encode', 'decode'],
  icon: 'Binary',
  relatedTools: ['hex-text', 'url-encode', 'base32-text', 'hash-text'],
  loadWasm: true,
};

export default meta;
