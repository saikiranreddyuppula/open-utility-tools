import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-column-math-v1',
  name: 'CSV Column Math',
  slug: 'csv-column-math',
  description:
    'Add a computed column to a CSV using an arithmetic expression over existing numeric columns, evaluated safely without eval.',
  category: 'data',
  tags: ['csv', 'formula', 'calculate', 'column', 'expression'],
  keywords: [
    'csv formula',
    'computed column',
    'arithmetic',
    'spreadsheet formula',
    'derive column',
    'price times quantity',
    'expression evaluator',
  ],
  icon: 'SquareFunction',
  relatedTools: [],
};

export default meta;
