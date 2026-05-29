import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-credit-card-v1',
  name: 'Credit Card Number Generator',
  slug: 'generate-credit-card',
  description:
    'Generate Luhn-valid fake test card numbers by brand (Visa, Mastercard, Amex, Discover) with optional expiry and CVV, for payment-form testing only.',
  category: 'generators',
  tags: ['credit card', 'luhn', 'test'],
  keywords: ['credit card', 'luhn', 'test', 'fake', 'visa', 'mastercard'],
  icon: 'CreditCard',
  relatedTools: [],
};

export default meta;
