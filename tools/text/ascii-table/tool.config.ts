import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-ascii-table-v1',
  name: 'ASCII Table',
  slug: 'ascii-table',
  description: 'A searchable reference of ASCII codes in decimal, hex, octal and binary.',
  category: 'text',
  tags: ['ascii', 'table', 'reference', 'charcode'],
  keywords: ['ascii table', 'character codes', 'charcode', 'dec hex oct', 'reference'],
  icon: 'Table',
  relatedTools: ['number-base-converter', 'binary-text', 'hex-text'],
};

export default meta;
