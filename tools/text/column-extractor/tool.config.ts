import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-column-extractor-v1',
  name: 'Column / Field Extractor (cut)',
  slug: 'column-extractor',
  description:
    'Extract or reorder fields from delimited lines like the Unix cut command, by index or character range.',
  category: 'text',
  tags: ['cut', 'fields', 'columns', 'extract', 'delimited'],
  keywords: [
    'cut command',
    'extract fields',
    'select columns',
    'reorder columns',
    'character range',
    'csv columns',
    'delimited',
  ],
  icon: 'Columns3',
  relatedTools: [],
};

export default meta;
