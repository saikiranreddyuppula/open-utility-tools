import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-sort-lines-v1',
  name: 'Sort & Dedupe Lines',
  slug: 'sort-lines',
  description: 'Sort lines alphabetically, numerically, by length, reverse or shuffle — and dedupe.',
  category: 'text',
  tags: ['sort', 'lines', 'dedupe', 'unique', 'shuffle', 'reverse'],
  keywords: ['sort lines', 'dedupe', 'unique', 'alphabetical', 'shuffle', 'reverse lines'],
  icon: 'SortAsc',
  relatedTools: ['remove-duplicates', 'word-count', 'case-converter'],
};

export default meta;
