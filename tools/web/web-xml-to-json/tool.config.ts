import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-xml-to-json-v1',
  name: 'XML to JSON',
  slug: 'web-xml-to-json',
  description:
    'Convert an XML document into a structured JSON object, mapping elements, attributes, and text content with a predictable convention.',
  category: 'web',
  tags: ['xml', 'json', 'convert'],
  keywords: ['xml', 'json', 'convert', 'parse', 'dom', 'attributes'],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
