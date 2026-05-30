import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-fill-blanks-v1',
  name: 'CSV Fill Blank Cells',
  slug: 'csv-fill-blanks',
  description:
    'Fill empty cells in a CSV by forward-fill, back-fill, a constant value, or per-column mean/median.',
  category: 'data',
  tags: ['csv', 'fill', 'impute', 'missing', 'cleanup'],
  keywords: [
    'csv fill blanks',
    'forward fill',
    'back fill',
    'fillna',
    'impute missing',
    'fill empty cells',
    'replace null',
    'data cleaning',
  ],
  icon: 'PaintBucket',
  relatedTools: [],
};

export default meta;
