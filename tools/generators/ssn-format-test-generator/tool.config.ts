import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-ssn-format-test-generator-v1',
  name: 'SSN-Format Test Number Generator',
  slug: 'ssn-format-test-generator',
  description:
    'Generate format-valid but non-issuable US SSN test numbers (e.g. 900-xx-xxxx, 666 area) for QA.',
  category: 'generators',
  tags: ['ssn', 'test-data', 'qa', 'placeholder', 'fake', 'us'],
  keywords: [
    'fake ssn',
    'test ssn',
    'social security number',
    'never issued',
    'qa data',
    'itin',
    'placeholder',
  ],
  icon: 'FileBadge',
  relatedTools: [],
};

export default meta;
