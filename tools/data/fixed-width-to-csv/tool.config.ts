import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-fixed-width-to-csv-v1',
  name: 'Fixed-Width to CSV',
  slug: 'fixed-width-to-csv',
  description:
    'Parse fixed-width / column-aligned text into CSV by defining field widths or cut positions.',
  category: 'data',
  tags: ['fixed-width', 'csv', 'columns', 'parse', 'convert'],
  keywords: [
    'fixed width to csv',
    'column aligned',
    'flat file',
    'field widths',
    'cut positions',
    'mainframe',
  ],
  icon: 'Columns3',
  relatedTools: [],
};

export default meta;
