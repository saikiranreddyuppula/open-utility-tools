import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-iban-validator-v1',
  name: 'IBAN Validator',
  slug: 'iban-validator',
  description: 'Validate an IBAN using the ISO 13616 mod-97 checksum and show its structure.',
  category: 'crypto',
  tags: ['iban', 'bank', 'mod-97', 'iso-13616', 'validate'],
  keywords: ['iban', 'international bank account number', 'mod 97', 'iso 13616', 'bban', 'checksum', 'bank'],
  icon: 'Landmark',
  relatedTools: [],
};

export default meta;
