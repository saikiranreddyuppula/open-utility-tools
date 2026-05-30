import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-transpose-v1',
  name: 'CSV Transpose',
  slug: 'csv-transpose',
  description: 'Swap rows and columns of a CSV so the first column becomes the header row and vice versa.',
  category: 'data',
  tags: ['csv', 'transpose', 'rows', 'columns'],
  keywords: ['csv', 'tsv', 'transpose', 'pivot', 'rotate', 'flip', 'rows', 'columns', 'matrix'],
  icon: 'ArrowDownUp',
  relatedTools: [],
};

export default meta;
