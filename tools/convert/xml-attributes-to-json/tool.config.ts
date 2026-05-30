import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-xml-attributes-to-json-v1',
  name: 'XML to JSON (Attribute Mode)',
  slug: 'xml-attributes-to-json',
  description: 'Convert XML to JSON preserving attributes via a convention.',
  category: 'convert',
  tags: ['xml', 'json', 'attributes', 'convert', 'parse'],
  keywords: ['xml to json', '@attribute', '#text', 'dom', 'convention', 'coerce'],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
