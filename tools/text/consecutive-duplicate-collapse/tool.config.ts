import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-consecutive-duplicate-collapse-v1',
  name: 'Collapse Consecutive Duplicate Lines',
  slug: 'consecutive-duplicate-collapse',
  description: 'Collapse runs of identical adjacent lines into one, like the uniq command.',
  category: 'text',
  tags: ['uniq', 'duplicate', 'lines', 'collapse', 'dedupe'],
  keywords: [
    'uniq',
    'collapse duplicates',
    'consecutive lines',
    'adjacent duplicates',
    'uniq -c',
    'count lines',
    'repeated lines',
  ],
  icon: 'Rows3',
  relatedTools: [],
};

export default meta;
