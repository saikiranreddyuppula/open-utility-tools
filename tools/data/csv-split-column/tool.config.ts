import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-split-column-v1',
  name: 'CSV Split Column',
  slug: 'csv-split-column',
  description:
    'Split one CSV column into multiple columns on a delimiter, regex, or fixed character position.',
  category: 'data',
  tags: ['csv', 'split', 'columns', 'delimiter', 'regex'],
  keywords: ['csv split', 'split column', 'explode column', 'text to columns', 'fixed position split'],
  icon: 'SplitSquareHorizontal',
  relatedTools: [],
};

export default meta;
