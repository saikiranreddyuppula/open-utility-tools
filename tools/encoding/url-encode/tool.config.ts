import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-url-encode-v1',
  name: 'URL Encode / Decode',
  slug: 'url-encode',
  description: 'Percent-encode and decode text or whole-component URL strings.',
  category: 'encoding',
  tags: ['url', 'percent', 'uri', 'encode', 'decode'],
  keywords: ['url', 'uri', 'percent encoding', 'escape', 'encodeURIComponent'],
  icon: 'Link',
  relatedTools: ['base64-text', 'html-entities', 'jwt-decoder'],
};

export default meta;
