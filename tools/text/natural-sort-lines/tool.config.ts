import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-natural-sort-lines-v1',
  name: 'Natural / Numeric Sort Lines',
  slug: 'natural-sort-lines',
  description:
    'Sort lines using human-friendly natural ordering so file2 comes before file10, with locale and key options.',
  category: 'text',
  tags: ['sort', 'natural', 'numeric', 'lines', 'order'],
  keywords: [
    'natural sort',
    'numeric sort',
    'human sort',
    'alphanumeric',
    'collator',
    'sort lines',
    'sort by field',
    'sort by length',
  ],
  icon: 'SortAsc',
  relatedTools: [],
};

export default meta;
