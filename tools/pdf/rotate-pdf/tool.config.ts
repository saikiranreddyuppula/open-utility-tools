import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-rotate-v1',
  name: 'Rotate PDF',
  slug: 'rotate-pdf',
  description: 'Rotate all or selected pages of a PDF by 90, 180 or 270 degrees.',
  category: 'pdf',
  tags: ['pdf', 'rotate', 'orientation', 'pages'],
  keywords: ['rotate pdf', 'turn pages', 'orientation', 'landscape', 'portrait'],
  icon: 'RotateCw',
  relatedTools: ['merge-pdf', 'split-pdf', 'pdf-metadata'],
  loadWasm: true,
};

export default meta;
