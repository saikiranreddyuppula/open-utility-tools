import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-luhn-validator-v1',
  name: 'Luhn Checksum Validator',
  slug: 'luhn-validator',
  description: 'Validate any Luhn-based number (credit cards, IMEI, etc.) and compute its check digit.',
  category: 'crypto',
  tags: ['luhn', 'checksum', 'credit-card', 'validator', 'mod10'],
  keywords: ['luhn algorithm', 'mod 10', 'imei', 'credit card check', 'check digit', 'iin'],
  icon: 'CreditCard',
  relatedTools: [],
};

export default meta;
