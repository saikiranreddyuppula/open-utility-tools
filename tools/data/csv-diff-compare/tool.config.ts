import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-diff-compare-v1',
  name: 'CSV Diff (Compare Two CSVs)',
  slug: 'csv-diff-compare',
  description:
    'Compare two CSV files by key columns or row position and see added, removed and changed rows and cells, with options for case, whitespace, numbers and column order.',
  category: 'data',
  tags: ['csv', 'diff', 'compare', 'spreadsheet', 'data'],
  keywords: [
    'csv diff',
    'compare csv files',
    'csv compare online',
    'diff two csv',
    'csv difference',
    'find changed rows',
    'csv key column compare',
    'spreadsheet diff',
    'tsv diff',
    'csv reconcile',
    'csv changes',
  ],
  icon: 'GitCompare',
  relatedTools: ['csv-viewer', 'json-diff', 'text-diff', 'csv-dedupe'],
};

export default meta;
