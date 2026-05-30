import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-fuzzy-dedupe-lines-v1',
  name: 'Fuzzy Duplicate Line Remover',
  slug: 'fuzzy-dedupe-lines',
  description: 'Remove near-duplicate lines that differ only by case, whitespace, or punctuation.',
  category: 'text',
  tags: ['dedupe', 'duplicate', 'fuzzy', 'lines', 'normalize'],
  keywords: ['fuzzy dedupe', 'near duplicate', 'remove similar lines', 'normalize lines', 'unique', 'case insensitive dedupe'],
  icon: 'Eraser',
  relatedTools: [],
};

export default meta;
