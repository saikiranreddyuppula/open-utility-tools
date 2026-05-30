import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-frequency-filter-v1',
  name: 'Filter Lines by Rule',
  slug: 'text-frequency-filter',
  description:
    'Keep or delete lines that match a substring, regex, length, or numeric/blank condition (grep-like).',
  category: 'text',
  tags: ['filter', 'lines', 'grep', 'regex', 'condition'],
  keywords: [
    'filter lines',
    'grep',
    'keep lines',
    'delete lines',
    'regex match',
    'line length filter',
    'remove blank lines',
    'remove duplicate lines',
  ],
  icon: 'ListFilter',
  relatedTools: [],
};

export default meta;
