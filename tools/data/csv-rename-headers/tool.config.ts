import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-csv-rename-headers-v1',
  name: 'CSV Header Renamer',
  slug: 'csv-rename-headers',
  description: 'Rename, reorder, and apply naming-convention transforms to CSV column headers.',
  category: 'data',
  tags: ['csv', 'headers', 'rename', 'reorder', 'case'],
  keywords: ['csv headers', 'rename columns', 'snake case', 'camelcase', 'reorder columns', 'column names'],
  icon: 'Heading',
  relatedTools: [],
};

export default meta;
