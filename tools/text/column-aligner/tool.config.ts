import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-column-aligner-v1',
  name: 'Column Aligner (Elastic Tabstops)',
  slug: 'column-aligner',
  description:
    'Align delimited columns into a neat fixed-width table by padding each column to its widest cell.',
  category: 'text',
  tags: ['align', 'columns', 'table', 'format', 'tabstops'],
  keywords: [
    'align columns',
    'elastic tabstops',
    'fixed width',
    'pad columns',
    'tabular',
    'markdown table',
    'pretty print',
  ],
  icon: 'AlignJustify',
  relatedTools: [],
};

export default meta;
