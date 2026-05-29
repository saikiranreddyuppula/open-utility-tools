import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-merge-v1',
  name: 'Merge PDF',
  slug: 'merge-pdf',
  description: 'Combine multiple PDFs into one, reorder by drag — entirely in your browser.',
  category: 'pdf',
  tags: ['pdf', 'merge', 'combine', 'join'],
  keywords: ['merge pdf', 'combine pdf', 'join pdf', 'concatenate'],
  icon: 'Combine',
  relatedTools: ['split-pdf', 'rotate-pdf', 'pdf-metadata'],
  loadWasm: true,
};

export default meta;
