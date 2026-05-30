import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-phone-number-format-generator-v1',
  name: 'Phone Number Format Generator',
  slug: 'phone-number-format-generator',
  description:
    'Generate fake phone numbers formatted per country/style (E.164, national, dashed) from reserved test ranges.',
  category: 'generators',
  tags: ['phone', 'fake-data', 'e164', 'test-data', 'qa'],
  keywords: ['phone number', 'fake phone', 'e.164', 'test number', 'dial code', 'mock data', 'csv'],
  icon: 'Smartphone',
  relatedTools: [],
};

export default meta;
