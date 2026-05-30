import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generators-fake-credit-card-luhn-set-v1',
  name: 'Test Card Number Set Generator',
  slug: 'generators-fake-credit-card-luhn-set',
  description:
    'Generates batches of Luhn-valid fake card numbers per brand for testing (clearly non-real).',
  category: 'generators',
  tags: ['credit-card', 'luhn', 'test-data', 'mock', 'payment'],
  keywords: ['fake credit card', 'luhn', 'test card', 'visa', 'mastercard', 'amex', 'discover', 'cvv'],
  icon: 'CreditCard',
  relatedTools: [],
};

export default meta;
