import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-schema-validator-v1',
  name: 'JSON Schema Validator',
  slug: 'json-schema-validator',
  description:
    'Validate a JSON document against a JSON Schema (Draft-07, 2019-09 or 2020-12) and see every error with its instance path, schema path and a readable message.',
  category: 'data',
  tags: ['json', 'schema', 'validator', 'jsonschema', 'validation'],
  keywords: [
    'json schema validator',
    'validate json against schema',
    'jsonschema',
    'ajv',
    'draft-07',
    '2019-09',
    '2020-12',
    'schema validation errors',
    'json validation online',
    'unevaluatedProperties',
    'oneOf anyOf allOf',
    'format validation',
  ],
  icon: 'ShieldCheck',
  relatedTools: ['json-validator', 'json-schema-sample-generator', 'json-to-json-schema', 'json-formatter'],
};

export default meta;
