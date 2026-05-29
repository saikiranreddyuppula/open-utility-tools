import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-html-entities-v1',
  name: 'HTML Entity Encode / Decode',
  slug: 'html-entities',
  description: 'Escape text to HTML entities and unescape entities back to text.',
  category: 'encoding',
  tags: ['html', 'entities', 'escape', 'unescape'],
  keywords: ['html entities', 'escape', 'unescape', 'ampersand', 'nbsp'],
  icon: 'Code',
  relatedTools: ['url-encode', 'base64-text', 'json-formatter'],
};

export default meta;
