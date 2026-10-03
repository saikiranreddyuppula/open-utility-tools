import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-list-compare-v1',
  name: 'List Compare (Diff Two Lists)',
  slug: 'list-compare',
  description:
    'Compare two lists to find items only in A, only in B, in both, the union, the symmetric difference and duplicates, with case, accent and CSV column options.',
  category: 'text',
  tags: ['list', 'compare', 'diff', 'intersection', 'union', 'duplicates'],
  keywords: [
    'compare two lists',
    'list diff',
    'set difference',
    'intersection',
    'venn diagram',
    'jaccard similarity',
    'find duplicates',
    'csv column compare',
    'common items',
    'unique items',
  ],
  icon: 'GitCompare',
  relatedTools: ['remove-duplicates', 'text-diff', 'sort-lines', 'fuzzy-dedupe-lines'],
};

export default meta;
