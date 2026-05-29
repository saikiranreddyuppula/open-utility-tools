import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-sort-keys-v1',
  name: 'JSON Sort Keys',
  slug: 'json-sort-keys',
  description: 'Recursively sort all object keys in a JSON document alphabetically.',
  category: 'data',
  tags: ['json', 'sort', 'keys', 'normalize', 'canonical'],
  keywords: ['json sort keys', 'alphabetize json', 'canonical json', 'normalize'],
  icon: 'SortAsc',
  relatedTools: ['json-formatter', 'json-diff', 'json-minify'],
};

export default meta;
