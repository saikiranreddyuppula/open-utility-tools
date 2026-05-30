import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-ean-upc-barcode-data-generator-v1',
  name: 'EAN/UPC Check Digit & Number Generator',
  slug: 'ean-upc-barcode-data-generator',
  description:
    'Generate valid EAN-13, EAN-8, UPC-A, and ISBN-13 numbers with correct check digits, or fix a partial code.',
  category: 'generators',
  tags: ['barcode', 'ean', 'upc', 'isbn', 'check-digit'],
  keywords: [
    'ean-13',
    'ean-8',
    'upc-a',
    'isbn-13',
    'isbn-10',
    'check digit',
    'gs1',
    'mod-10',
    'mod-11',
    'gtin',
    'product code',
  ],
  icon: 'ScanLine',
  relatedTools: [],
};

export default meta;
