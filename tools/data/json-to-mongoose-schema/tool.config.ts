import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-mongoose-schema-v1',
  name: 'JSON to Mongoose Schema',
  slug: 'json-to-mongoose-schema',
  description: 'Generate a Mongoose schema definition from a JSON sample.',
  category: 'data',
  tags: ['json', 'mongoose', 'mongodb', 'schema', 'codegen'],
  keywords: ['json to mongoose', 'mongodb schema', 'mongoose model', 'odm', 'codegen'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
