import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-to-fixed-width-v1',
  name: 'CSV to Fixed-Width',
  slug: 'csv-to-fixed-width',
  description:
    'Convert CSV into fixed-width / column-aligned text with per-column widths and alignment.',
  category: 'data',
  tags: ['csv', 'fixed-width', 'align', 'columns', 'table'],
  keywords: ['fixed width', 'column aligned', 'ascii table', 'monospace table', 'padded columns', 'flat file'],
  icon: 'AlignJustify',
  relatedTools: [],
};

export default meta;
