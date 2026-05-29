import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-iban-v1',
  name: 'IBAN Generator',
  slug: 'generate-iban',
  description:
    'Generate valid-format test IBANs per country with correct length and ISO 7064 mod-97 check digits, useful for banking and form validation testing.',
  category: 'generators',
  tags: ['iban', 'bank', 'test'],
  keywords: ['iban', 'bank', 'mod-97', 'test', 'account', 'validation'],
  icon: 'Banknote',
  relatedTools: [],
};

export default meta;
