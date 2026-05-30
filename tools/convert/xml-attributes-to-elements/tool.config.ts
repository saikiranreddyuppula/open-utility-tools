import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-xml-attributes-to-elements-v1',
  name: 'XML Attributes ↔ Child Elements',
  slug: 'xml-attributes-to-elements',
  description:
    'Rewrite an XML document by promoting attributes into child elements, or demoting simple child elements into attributes.',
  category: 'convert',
  tags: ['xml', 'attributes', 'elements', 'transform', 'refactor'],
  keywords: ['xml attributes to elements', 'promote', 'demote', 'dom', 'restructure', 'pretty print'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
