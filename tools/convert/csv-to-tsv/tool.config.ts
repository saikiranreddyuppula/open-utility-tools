import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-csv-to-tsv-v1',
  name: 'CSV to TSV',
  slug: 'csv-to-tsv',
  description:
    'Convert between comma-separated and tab-separated values with proper quote handling, in either direction, ready to paste into a spreadsheet.',
  category: 'convert',
  tags: ['csv', 'tsv', 'convert'],
  keywords: ['csv', 'tsv', 'tab', 'convert', 'spreadsheet', 'delimiter'],
  icon: 'ArrowLeftRight',
  relatedTools: [],
};

export default meta;
