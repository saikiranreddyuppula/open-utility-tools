import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-pdf-watermark-v1',
  name: 'Watermark PDF',
  slug: 'pdf-watermark',
  description:
    'Add a text watermark (CONFIDENTIAL, DRAFT, custom) to PDF pages: diagonal or tiled, with opacity, colour, font and over/under layering.',
  category: 'pdf',
  tags: ['pdf', 'watermark', 'stamp', 'confidential', 'draft'],
  keywords: [
    'watermark pdf',
    'add watermark to pdf',
    'pdf stamp text',
    'confidential watermark',
    'draft watermark',
    'diagonal watermark',
    'tiled watermark',
  ],
  icon: 'Stamp',
  relatedTools: ['merge-pdf', 'split-pdf', 'rotate-pdf', 'pdf-metadata'],
  loadWasm: true,
};

export default meta;
