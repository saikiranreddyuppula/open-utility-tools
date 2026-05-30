import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-html-named-numeric-v1',
  name: 'HTML Named ↔ Numeric Entity Converter',
  slug: 'encoding-html-named-numeric',
  description:
    'Convert HTML named entities to and from their decimal and hexadecimal numeric character references, both ways.',
  category: 'encoding',
  tags: ['html', 'entities', 'named', 'numeric', 'convert'],
  keywords: [
    'html entity',
    'named entity',
    'numeric entity',
    'character reference',
    'amp',
    'nbsp',
    'hex entity',
    'decimal entity',
  ],
  icon: 'Ampersand',
  relatedTools: [],
};

export default meta;
