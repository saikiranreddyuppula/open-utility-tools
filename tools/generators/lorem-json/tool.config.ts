import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-mock-json-v1',
  name: 'Mock Data Generator',
  slug: 'mock-data',
  description: 'Generate an array of realistic fake records (names, emails, dates) as JSON.',
  category: 'generators',
  tags: ['fake data', 'mock', 'test data', 'json', 'seed'],
  keywords: ['fake data', 'mock data', 'test data', 'faker', 'seed', 'json generator'],
  icon: 'Database',
  relatedTools: ['uuid-generator', 'lorem-ipsum', 'json-formatter'],
};

export default meta;
