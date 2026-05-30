import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-vcard-generator-v1',
  name: 'vCard (.vcf) Generator',
  slug: 'vcard-generator',
  description: 'Generate vCard 3.0/4.0 contact text from name, org, phones, emails, address, and URL fields.',
  category: 'generators',
  tags: ['vcard', 'vcf', 'contact', 'rfc6350', 'address-book'],
  keywords: ['vcard generator', 'vcf file', 'contact card', 'vcard 3.0', 'vcard 4.0', 'address book'],
  icon: 'Sparkles',
  relatedTools: [],
};

export default meta;
