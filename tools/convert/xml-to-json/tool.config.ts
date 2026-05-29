import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-xml-to-json-v1',
  name: 'XML to JSON',
  slug: 'xml-to-json',
  description: 'Parse XML into a clean JSON tree with options for attribute prefixes, text-node naming, and array coercion for repeated elements.',
  category: 'convert',
  tags: ['xml', 'json', 'convert'],
  keywords: ['xml', 'json', 'convert', 'parse', 'attributes', 'dom'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
