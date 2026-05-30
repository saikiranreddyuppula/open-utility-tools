import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-key-value-to-json-v1',
  name: 'key=value Lines to JSON',
  slug: 'key-value-to-json',
  description:
    'Convert plain key=value or key: value config lines into a JSON object, with type coercion and nesting on dotted keys.',
  category: 'convert',
  tags: ['json', 'config', 'convert', 'key-value'],
  keywords: ['key value', 'config', 'json', 'ini', 'nested', 'dotted', 'coerce', 'convert'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
