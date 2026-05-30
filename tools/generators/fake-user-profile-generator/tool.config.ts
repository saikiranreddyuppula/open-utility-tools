import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-fake-user-profile-generator-v1',
  name: 'Fake User Profile Generator',
  slug: 'fake-user-profile-generator',
  description:
    'Generate realistic fake user records (name, email, username, phone, avatar seed) from built-in static name lists.',
  category: 'generators',
  tags: ['fake', 'user', 'profile', 'test-data', 'mock'],
  keywords: ['fake users', 'mock data', 'seed', 'faker', 'test accounts', 'csv', 'json', 'ndjson'],
  icon: 'User',
  relatedTools: [],
};

export default meta;
