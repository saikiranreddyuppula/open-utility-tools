import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-barcode-v1',
  name: 'Barcode Generator',
  slug: 'generate-barcode',
  description:
    'Generate Code 39 and EAN-13 barcodes from input text/digits, rendered to a downloadable SVG/PNG with adjustable bar width and height.',
  category: 'generators',
  tags: ['barcode', 'generator', 'image'],
  keywords: ['barcode', 'code39', 'ean13', 'scan', 'product', 'svg'],
  icon: 'ScanLine',
  relatedTools: [],
};

export default meta;
