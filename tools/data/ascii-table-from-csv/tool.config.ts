import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-ascii-table-from-csv-v1',
  name: 'ASCII Box Table from CSV',
  slug: 'ascii-table-from-csv',
  description:
    'Render CSV as a bordered ASCII or Unicode box-drawing table for READMEs, code comments, and terminals.',
  category: 'data',
  tags: ['csv', 'ascii', 'table', 'box-drawing', 'terminal', 'markdown'],
  keywords: [
    'csv to ascii table',
    'box drawing',
    'unicode table',
    'pretty table',
    'terminal table',
    'readme table',
    'tabulate',
    'aligned columns',
  ],
  icon: 'Grid3x3',
  relatedTools: [],
};

export default meta;
