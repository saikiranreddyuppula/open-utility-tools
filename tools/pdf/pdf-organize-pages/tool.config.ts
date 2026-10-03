import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-pdf-organize-pages-v1',
  name: 'Organize PDF Pages',
  slug: 'pdf-organize-pages',
  description:
    'Reorder, duplicate, delete and reverse PDF pages with drag and drop, or interleave front and back scans into one document.',
  category: 'pdf',
  tags: ['pdf', 'reorder', 'pages', 'interleave', 'duplex'],
  keywords: [
    'reorder pdf pages',
    'rearrange pdf',
    'organize pdf',
    'reverse pdf pages',
    'duplicate pdf page',
    'interleave pdf',
    'collate duplex scan',
    'odd even pages',
    'sort pdf pages',
  ],
  icon: 'LayoutGrid',
  relatedTools: ['merge-pdf', 'split-pdf', 'rotate-pdf'],
  loadWasm: true,
};

export default meta;
