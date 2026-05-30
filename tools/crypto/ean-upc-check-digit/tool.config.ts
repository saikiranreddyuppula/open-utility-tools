import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-ean-upc-check-digit-v1',
  name: 'EAN / UPC Check Digit',
  slug: 'ean-upc-check-digit',
  description: 'Validate or compute check digits for EAN-13, EAN-8, and UPC-A barcodes.',
  category: 'crypto',
  tags: ['ean', 'upc', 'barcode', 'check-digit', 'gs1'],
  keywords: ['ean-13', 'ean-8', 'upc-a', 'barcode', 'check digit', 'gs1', 'gtin', 'mod 10'],
  icon: 'ScanLine',
  relatedTools: [],
};

export default meta;
