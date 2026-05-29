import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-json-to-xml-v1',
  name: 'JSON to XML',
  slug: 'json-to-xml',
  description: 'Convert JSON into XML markup with proper escaping.',
  category: 'convert',
  tags: ['json', 'xml', 'convert', 'markup'],
  keywords: ['json to xml', 'convert', 'xml markup', 'serialize'],
  icon: 'ArrowLeftRight',
  relatedTools: ['json-to-yaml', 'json-formatter', 'json-to-csv'],
};

export default meta;
