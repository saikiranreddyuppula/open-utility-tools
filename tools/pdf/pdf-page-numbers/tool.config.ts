import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-pdf-page-numbers-v1',
  name: 'Add Page Numbers to PDF',
  slug: 'pdf-page-numbers',
  description:
    'Stamp page numbers onto a PDF with custom formats, Bates numbering, position, page range and fonts, all in your browser.',
  category: 'pdf',
  tags: ['pdf', 'page numbers', 'bates', 'stamp', 'footer'],
  keywords: [
    'add page numbers to pdf',
    'number pdf pages',
    'pdf pagination',
    'bates numbering',
    'page x of y',
    'pdf footer',
    'pdf header numbering',
  ],
  icon: 'Hash',
  relatedTools: ['merge-pdf', 'split-pdf', 'rotate-pdf', 'pdf-metadata'],
  loadWasm: true,
};

export default meta;
