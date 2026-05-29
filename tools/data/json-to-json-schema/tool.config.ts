import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-json-schema-v1',
  name: 'JSON Schema Generator',
  slug: 'json-to-json-schema',
  description: 'Infer a JSON Schema (draft-07) from a sample JSON document with types and required fields.',
  category: 'data',
  tags: ['json', 'schema', 'validation'],
  keywords: ['json', 'schema', 'json schema', 'generate', 'validation'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
