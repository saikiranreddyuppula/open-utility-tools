import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-escape-v1',
  name: 'JSON String Escape / Unescape',
  slug: 'json-escape',
  description: 'Escape text into a JSON string literal, or unescape one back to raw text.',
  category: 'data',
  tags: ['json', 'escape', 'unescape', 'string', 'stringify'],
  keywords: ['json escape', 'unescape', 'stringify', 'json string', 'quote'],
  icon: 'Quote',
  relatedTools: ['json-formatter', 'json-minify', 'html-entities'],
};

export default meta;
