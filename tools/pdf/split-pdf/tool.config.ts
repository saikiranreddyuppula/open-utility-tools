import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-split-v1',
  name: 'Split / Extract PDF Pages',
  slug: 'split-pdf',
  description: 'Extract or delete a selection of pages from a PDF (e.g. 1,3,5-8).',
  category: 'pdf',
  tags: ['pdf', 'split', 'extract', 'pages', 'delete'],
  keywords: ['split pdf', 'extract pages', 'delete pages', 'pdf pages', 'remove pages'],
  icon: 'Scissors',
  relatedTools: ['merge-pdf', 'rotate-pdf', 'pdf-metadata'],
  loadWasm: true,
};

export default meta;
