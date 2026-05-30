import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-codepoint-utf-converter-v1',
  name: 'Code Point ↔ UTF-8/UTF-16 Bytes',
  slug: 'encoding-codepoint-utf-converter',
  description: 'Convert Unicode code points to their UTF-8 and UTF-16 byte encodings and back.',
  category: 'encoding',
  tags: ['unicode', 'utf-8', 'utf-16', 'code-point', 'bytes'],
  keywords: ['code point', 'utf8', 'utf16', 'utf32', 'surrogate pair', 'unicode bytes', 'u+'],
  icon: 'Type',
  relatedTools: [],
};

export default meta;
