import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-pdf-compress-v1',
  name: 'Compress PDF',
  slug: 'pdf-compress',
  description:
    'Shrink a PDF by recompressing and downscaling its images and cleaning up the file structure, entirely in your browser.',
  category: 'pdf',
  tags: ['pdf', 'compress', 'reduce size', 'optimize', 'images'],
  keywords: [
    'compress pdf',
    'reduce pdf size',
    'shrink pdf',
    'pdf optimizer',
    'make pdf smaller',
    'pdf too large',
    'pdf image compression',
  ],
  icon: 'Minimize2',
  relatedTools: ['merge-pdf', 'split-pdf', 'image-to-pdf', 'pdf-metadata'],
  loadWasm: true,
};

export default meta;
