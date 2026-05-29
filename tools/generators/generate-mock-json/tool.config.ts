import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-mock-json-v1',
  name: 'JSON Mock Data Generator',
  slug: 'generate-mock-json',
  description:
    'Generate arrays of realistic fake JSON records from a field schema (name, email, uuid, number, date, boolean) with a configurable row count for API mocking.',
  category: 'generators',
  tags: ['json', 'generator', 'data'],
  keywords: ['mock', 'json', 'fake', 'data', 'api', 'seed'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
