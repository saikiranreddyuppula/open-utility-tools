import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-ascii-table-to-json-v1',
  name: 'ASCII / Box Table to JSON',
  slug: 'ascii-table-to-json',
  description:
    'Parse a fixed-width or box-drawn ASCII table (like psql, MySQL, or markdown-less console output) into JSON rows.',
  category: 'convert',
  tags: ['ascii', 'table', 'json', 'parse', 'psql', 'mysql'],
  keywords: ['ascii table', 'box table', 'psql', 'mysql', 'console output', 'fixed width', 'json'],
  icon: 'Grid3x3',
  relatedTools: [],
};

export default meta;
