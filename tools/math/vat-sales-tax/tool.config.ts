import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-vat-sales-tax-v1',
  name: 'VAT & Sales Tax Calculator',
  slug: 'vat-sales-tax',
  description: 'Add or remove VAT/sales tax and split gross into net plus tax.',
  category: 'math',
  tags: ['tax', 'vat', 'finance', 'price', 'percentage'],
  keywords: [
    'vat',
    'sales tax',
    'gst',
    'net',
    'gross',
    'tax inclusive',
    'tax exclusive',
    'add tax',
    'remove tax',
  ],
  icon: 'Percent',
  relatedTools: [],
};

export default meta;
