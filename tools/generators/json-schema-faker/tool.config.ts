import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-json-schema-faker-v1',
  name: 'Fake Data From JSON Schema',
  slug: 'json-schema-faker',
  description:
    'Generate sample JSON instances that conform to a pasted JSON Schema (types, enums, formats, constraints).',
  category: 'generators',
  tags: ['json-schema', 'mock', 'fake-data', 'fixtures', 'testing'],
  keywords: [
    'json schema faker',
    'mock data',
    'sample json',
    'draft-07',
    'test fixtures',
    'fake api response',
    'generate json',
  ],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
