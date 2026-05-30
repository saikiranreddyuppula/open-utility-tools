import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-fake-company-generator-v1',
  name: 'Fake Company Generator',
  slug: 'fake-company-generator',
  description:
    'Generate fake company records: name, industry, catchphrase, domain, EIN-format tax id, from static word banks.',
  category: 'generators',
  tags: ['fake', 'company', 'test-data', 'mock', 'business'],
  keywords: [
    'fake company',
    'test data',
    'mock business',
    'company name',
    'industry',
    'catchphrase',
    'domain',
    'ein',
    'sample data',
  ],
  icon: 'Briefcase',
  relatedTools: [],
};

export default meta;
