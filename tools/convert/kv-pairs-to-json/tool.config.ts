import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-kv-pairs-to-json-v1',
  name: 'Key-Value Pairs to JSON',
  slug: 'kv-pairs-to-json',
  description: 'Convert key:value or key=value lines into a JSON object.',
  category: 'convert',
  tags: ['json', 'key-value', 'convert', 'parse'],
  keywords: ['key value', 'pairs', 'json', 'convert', 'separator', 'coerce', 'nested', 'array'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
