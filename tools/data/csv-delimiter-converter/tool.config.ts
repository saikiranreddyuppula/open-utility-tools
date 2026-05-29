import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-delimiter-converter-v1',
  name: 'CSV Delimiter Converter',
  slug: 'csv-delimiter-converter',
  description: 'Re-delimit tabular data between comma, tab, semicolon, or pipe while preserving quoting.',
  category: 'data',
  tags: ['csv', 'tsv'],
  keywords: ['csv', 'tsv', 'delimiter', 'convert', 'tab'],
  icon: 'ArrowLeftRight',
  relatedTools: [],
};

export default meta;
