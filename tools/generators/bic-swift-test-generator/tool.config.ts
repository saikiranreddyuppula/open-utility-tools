import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-bic-swift-test-generator-v1',
  name: 'BIC / SWIFT Code Test Generator',
  slug: 'bic-swift-test-generator',
  description: 'Generate structurally valid test BIC/SWIFT codes (8 or 11 chars) with bank, country, location, branch parts.',
  category: 'generators',
  tags: ['bic', 'swift', 'iso-9362', 'banking', 'test-data', 'fake'],
  keywords: ['bic generator', 'swift code', 'iso 9362', 'bank identifier code', 'test bic', 'mock banking data'],
  icon: 'Landmark',
  relatedTools: [],
};

export default meta;
