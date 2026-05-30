import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-fake-address-generator-v1',
  name: 'Fake Address Generator',
  slug: 'fake-address-generator',
  description:
    'Produce fake postal addresses (street, city, region, postal code, country) per country format from static lists.',
  category: 'generators',
  tags: ['fake', 'address', 'test-data', 'mock', 'postal'],
  keywords: [
    'fake address',
    'test data',
    'mock address',
    'postal code',
    'zip',
    'street',
    'city',
    'sample data',
    'placeholder',
  ],
  icon: 'MapPin',
  relatedTools: [],
};

export default meta;
