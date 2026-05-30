import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-json-to-xml-attributes-v1',
  name: 'JSON to XML (Attribute Mode)',
  slug: 'json-to-xml-attributes',
  description: 'Convert JSON to XML choosing attributes vs child elements.',
  category: 'convert',
  tags: ['json', 'xml', 'attributes', 'convert', 'serialize'],
  keywords: ['json to xml', 'xml attributes', '@text convention', 'scalars as attributes', 'markup'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
