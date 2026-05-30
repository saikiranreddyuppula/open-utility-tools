import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-json-array-chunk-v1',
  name: 'JSON Array Chunker',
  slug: 'data-json-array-chunk',
  description: 'Split a large JSON array into fixed-size chunks of smaller arrays.',
  category: 'data',
  tags: ['json', 'array', 'chunk', 'split'],
  keywords: ['json', 'array', 'chunk', 'split', 'batch', 'partition', 'paginate'],
  icon: 'SplitSquareHorizontal',
  relatedTools: [],
};

export default meta;
