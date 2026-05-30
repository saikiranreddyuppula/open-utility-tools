import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-json-to-kv-pairs-v1',
  name: 'JSON to Key-Value Pairs',
  slug: 'json-to-kv-pairs',
  description: 'Convert a JSON object into flat key:value text lines.',
  category: 'convert',
  tags: ['json', 'flatten', 'key-value', 'convert', 'pairs'],
  keywords: ['json to key value', 'flatten json', 'dotted keys', 'kv pairs', 'leaf values'],
  icon: 'List',
  relatedTools: [],
};

export default meta;
