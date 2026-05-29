import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-extract-keys-v1',
  name: 'JSON Key Extractor',
  slug: 'json-extract-keys',
  description: 'List every unique key path in a JSON document, optionally with the inferred type of each.',
  category: 'data',
  tags: ['json', 'keys'],
  keywords: ['json', 'keys', 'paths', 'extract', 'schema'],
  icon: 'ListOrdered',
  relatedTools: [],
};

export default meta;
