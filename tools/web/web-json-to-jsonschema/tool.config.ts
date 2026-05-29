import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-json-to-jsonschema-v1',
  name: 'JSON to JSON Schema',
  slug: 'web-json-to-jsonschema',
  description:
    'Generate a draft JSON Schema from an example JSON document, inferring types, required keys, array item shapes, and nested object definitions.',
  category: 'web',
  tags: ['json', 'schema', 'validation'],
  keywords: ['json', 'schema', 'jsonschema', 'validation', 'infer', 'draft'],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
